import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import type { PhotonImage as PhotonImageType } from "@cf-wasm/photon";
import {
  ARENA_FRAME_FORMAT,
  ARENA_FRAME_HEIGHT,
  ARENA_FRAME_WIDTH,
  ArenaFrameImageSourceSchema,
} from "@tom/schemas/arena-frame";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { logContextFromRequest } from "@tom/utils/worker";
import { runArena } from "./shared";

type PhotonModule = typeof import("@cf-wasm/photon");

const FRAME_IMAGE_CACHE_CONTROL = "public, max-age=3600, s-maxage=604800";

/** are.na serves block images from these hosts. Anything else is refused. */
const IMAGE_HOSTS = new Set([
  "cdn.are.na",
  "images.are.na",
  "d2w9rnfck5c9ki.cloudfront.net",
  "d2w9rnfcy7mm78.cloudfront.net",
]);

const FrameImageParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String, id: Schema.FiniteFromString }),
);

const isFrameImageHost = (url: URL): boolean =>
  url.protocol === "https:" && (IMAGE_HOSTS.has(url.hostname) || url.hostname.endsWith(".are.na"));

/**
 * 16-bit RGB, high byte first: the panel's DMA order. The firmware pushes
 * these bytes without decoding or byte-swapping.
 */
const toRgb565 = (rgba: Uint8Array): Uint8Array<ArrayBuffer> => {
  const pixelCount = ARENA_FRAME_WIDTH * ARENA_FRAME_HEIGHT;
  const frame = new Uint8Array(pixelCount * 2);
  for (let index = 0; index < pixelCount; index++) {
    const offset = index * 4;
    const red = rgba[offset] ?? 0;
    const green = rgba[offset + 1] ?? 0;
    const blue = rgba[offset + 2] ?? 0;
    const value = ((red & 0xf8) << 8) | ((green & 0xfc) << 3) | (blue >> 3);
    frame[index * 2] = value >> 8;
    frame[index * 2 + 1] = value & 0xff;
  }
  return frame;
};

/** Centre-crop to the panel's 16:9, so nothing is stretched. */
const cropToFrame = (photon: PhotonModule, image: PhotonImageType): PhotonImageType => {
  const width = image.get_width();
  const height = image.get_height();
  const targetRatio = ARENA_FRAME_WIDTH / ARENA_FRAME_HEIGHT;
  if (width / height > targetRatio) {
    const cropWidth = Math.max(1, Math.round(height * targetRatio));
    const left = Math.round((width - cropWidth) / 2);
    return photon.crop(image, left, 0, left + cropWidth, height);
  }
  const cropHeight = Math.max(1, Math.round(width / targetRatio));
  const top = Math.round((height - cropHeight) / 2);
  return photon.crop(image, 0, top, width, top + cropHeight);
};

const fetchImageBytes = (source: string): Effect.Effect<Uint8Array, HttpError> =>
  Effect.gen(function* () {
    const url = yield* Effect.fromOption(
      Schema.decodeOption(Schema.URLFromString)(source),
      () =>
        new HttpError({
          message: "Block image URL is invalid",
          status: HttpStatus.UnprocessableEntity,
        }),
    );
    if (!isFrameImageHost(url)) {
      return yield* new HttpError({
        message: "Block image host is not allowed",
        status: HttpStatus.UnprocessableEntity,
      });
    }
    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (cause) =>
        new HttpError({
          message: "Failed to fetch block image",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new HttpError({
        message: `Block image fetch failed: ${response.status}`,
        status: HttpStatus.BadGateway,
      });
    }
    return yield* Effect.tryPromise({
      try: () => response.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      catch: (cause) =>
        new HttpError({
          message: "Failed to read block image",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
  });

const renderFrame = (bytes: Uint8Array): Effect.Effect<Uint8Array<ArrayBuffer>, HttpError> =>
  Effect.tryPromise({
    try: async () => {
      const photon = await import("@cf-wasm/photon");
      const source = photon.PhotonImage.new_from_byteslice(bytes);
      const cropped = cropToFrame(photon, source);
      const resized = photon.resize(
        cropped,
        ARENA_FRAME_WIDTH,
        ARENA_FRAME_HEIGHT,
        photon.SamplingFilter.Lanczos3,
      );
      const frame = toRgb565(resized.get_raw_pixels());
      source.free();
      cropped.free();
      resized.free();
      return frame;
    },
    catch: (cause) =>
      new HttpError({
        message: "Failed to render block image",
        status: HttpStatus.UnprocessableEntity,
        cause,
      }),
  });

export const getArenaFrameImageRoute = new Elysia().get(
  "/arena/frame/:slug/image/:id",
  async ({ params, request }) => {
    const frame = await runArena(
      request,
      (client) =>
        Effect.gen(function* () {
          const block = yield* client.block(params.id).get;
          const decoded = yield* Schema.decodeUnknownEffect(ArenaFrameImageSourceSchema)(
            block,
          ).pipe(
            Effect.mapError(
              (cause) =>
                new HttpError({
                  message: "Unexpected are.na block response",
                  status: HttpStatus.BadGateway,
                  cause,
                }),
            ),
          );
          const image = decoded.image;
          if (image === null || image === undefined) {
            return yield* new HttpError({
              message: "Block has no image",
              status: HttpStatus.NotFound,
            });
          }
          const source = image.medium?.src ?? image.large?.src ?? image.src;
          if (source === undefined) {
            return yield* new HttpError({
              message: "Block image has no source",
              status: HttpStatus.NotFound,
            });
          }
          const bytes = yield* fetchImageBytes(source);
          return yield* renderFrame(bytes);
        }),
      logContextFromRequest(request, "tom-adapter"),
      "public",
    );
    return new Response(frame, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": FRAME_IMAGE_CACHE_CONTROL,
        "X-Frame-Width": String(ARENA_FRAME_WIDTH),
        "X-Frame-Height": String(ARENA_FRAME_HEIGHT),
        "X-Frame-Format": ARENA_FRAME_FORMAT,
      },
    });
  },
  {
    params: FrameImageParamsSchema,
    detail: {
      description: "Render one are.na block as a 240x135 RGB565 frame",
      tags: ["arena-frame"],
    },
  },
);

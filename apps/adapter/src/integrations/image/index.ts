import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { ImageError } from "@tom/types/errors";
import {
  logApiFailure,
  logContextFromRequest,
  runEffect,
  toErrorResponse,
} from "@tom/utils/services/worker";

const ALLOWED_DOMAINS = ["cdn.tom.so"];

const ImageQuerySchema = Schema.Struct({
  url: Schema.String,
  width: Schema.optional(Schema.NumberFromString),
  quality: Schema.optional(Schema.NumberFromString),
  format: Schema.optional(
    Schema.Union([Schema.Literal("jpeg"), Schema.Literal("png"), Schema.Literal("webp")]),
  ),
});

const imageQuerySchema = Schema.toStandardSchemaV1(ImageQuerySchema);

const toImageError = (message: string, cause?: unknown): ImageError => {
  const fields = cause === undefined ? {} : { cause };
  return new ImageError({
    response: toErrorResponse(HttpStatus.InternalServerError, message),
    ...fields,
  });
};

export const imageIntegration = new Elysia({ name: "image" }).get(
  "/image",
  ({ query, request }) => {
    const width = query.width ?? 800;
    const quality = query.quality ?? 85;
    const requestedFormat = query.format;

    const validateUrl = (urlStr: string): Effect.Effect<URL, ImageError> =>
      Effect.gen(function* () {
        const parsed = yield* Option.match(
          Schema.decodeUnknownOption(Schema.URLFromString)(urlStr),
          {
            onNone: () =>
              Effect.fail(
                new ImageError({
                  response: toErrorResponse(HttpStatus.BadRequest, "Invalid URL"),
                }),
              ),
            onSome: (url) => Effect.succeed(url),
          },
        );

        if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
          return yield* new ImageError({
            response: toErrorResponse(HttpStatus.Forbidden, "Domain not allowed"),
          });
        }

        return parsed;
      });

    const fetchImage = (validUrl: URL) =>
      Effect.tryPromise({
        try: () => fetch(validUrl),
        catch: (cause) => toImageError("Failed to fetch image", cause),
      }).pipe(
        Effect.flatMap((res) =>
          res.ok ? Effect.succeed(res) : Effect.fail(toImageError("Failed to fetch image")),
        ),
      );

    const processImage = (response: Response) =>
      Effect.gen(function* () {
        const buffer = yield* Effect.tryPromise({
          try: () => response.arrayBuffer(),
          catch: (cause) => toImageError("Failed to read image data", cause),
        });

        // Load the Photon WASM image processor lazily so it stays out of the
        // adapter's cold-start module graph (the /image route is its only user).
        const { PhotonImage, resize, SamplingFilter } = yield* Effect.tryPromise({
          try: () => import("@cf-wasm/photon"),
          catch: (cause) => toImageError("Failed to load image processor", cause),
        });

        return yield* Effect.try({
          try: () => {
            const originalFormat = response.headers.get("content-type");
            const photonImage = PhotonImage.new_from_byteslice(new Uint8Array(buffer));

            const aspectRatio = photonImage.get_height() / photonImage.get_width();
            const height = Math.round(width * aspectRatio);
            const resizedImage = resize(photonImage, width, height, SamplingFilter.Lanczos3);

            const format = requestedFormat || originalFormat?.split("/")[1] || "jpeg";
            const encoded =
              format === "png"
                ? { buffer: resizedImage.get_bytes(), contentType: "image/png" }
                : format === "webp"
                  ? { buffer: resizedImage.get_bytes_webp(), contentType: "image/webp" }
                  : { buffer: resizedImage.get_bytes_jpeg(quality), contentType: "image/jpeg" };

            return new Response(new Uint8Array(encoded.buffer), {
              headers: {
                "Content-Type": encoded.contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          },
          catch: (cause) => toImageError("Failed to process image", cause),
        });
      });

    const program = validateUrl(query.url).pipe(
      Effect.tap(() =>
        Effect.logInfo(
          `image:request url=${query.url} width=${width} quality=${quality} format=${requestedFormat ?? ""}`,
        ),
      ),
      Effect.flatMap(fetchImage),
      Effect.flatMap(processImage),
      Effect.tap((response) =>
        Effect.logDebug(
          `image:success contentType=${response.headers.get("content-type")} width=${width}`,
        ),
      ),
      Effect.catch(
        Effect.fn("imageErrorHandler")(function* (error: ImageError) {
          yield* logApiFailure("image:error", (error.response as Response).status, error.cause);
          return error.response;
        }),
      ),
    );

    return runEffect(program, logContextFromRequest(request, "tom-adapter"));
  },
  {
    query: imageQuerySchema,
    detail: { description: "Resize and re-encode images from cdn.tom.so", tags: ["images"] },
  },
);

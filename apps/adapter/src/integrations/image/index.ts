import { Elysia } from "elysia";
import { Schema } from "effect";
import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { ImageError } from "@tom/types/errors";
import { runEffect, toErrorResponse } from "@tom/utils/services/worker";

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

const toImageError = (message: string, cause?: unknown): ImageError =>
  new ImageError({
    response: toErrorResponse(HttpStatus.InternalServerError, message),
    ...(cause ? { cause } : {}),
  });

export const imageIntegration = new Elysia({ name: "image" }).get(
  "/image",
  ({ query }) => {
    const width = query.width ?? 800;
    const quality = query.quality ?? 85;
    const requestedFormat = query.format;

    const validateUrl = (urlStr: string): Effect.Effect<URL, ImageError> =>
      Effect.gen(function* () {
        const parsed = yield* Effect.try({
          try: () => new URL(urlStr),
          catch: () =>
            new ImageError({
              response: toErrorResponse(HttpStatus.BadRequest, "Invalid URL"),
            }),
        });

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
      Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: (cause) => toImageError("Failed to read image data", cause),
      }).pipe(
        Effect.flatMap((buffer) =>
          Effect.try({
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
          }),
        ),
      );

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
          yield* Effect.logError("image:error", error.cause);
          return error.response;
        }),
      ),
    );

    return runEffect(program);
  },
  {
    query: imageQuerySchema,
    detail: { description: "Resize and re-encode images from cdn.tom.so", tags: ["images"] },
  },
);

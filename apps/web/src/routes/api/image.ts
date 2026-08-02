import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";
import type { APIEvent } from "@solidjs/start/server";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { runSimpleEffect } from "~/libs/runtime";

const ALLOWED_DOMAINS = ["cdn.tom.so"];

type ImageError = { response: Response; cause?: unknown };

export async function GET({ request }: APIEvent) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");
  const width = parseInt(url.searchParams.get("width") || "800");
  const quality = parseInt(url.searchParams.get("quality") || "85");
  const requestedFormat = url.searchParams.get("format");

  const validateUrl = (urlStr: string | null): Effect.Effect<URL, ImageError> =>
    Effect.gen(function* () {
      if (!urlStr) {
        return yield* Effect.fail({
          response: new Response("Missing url parameter", {
            status: HttpStatus.BadRequest,
          }),
        });
      }

      const parsed = yield* Effect.try({
        try: () => new URL(urlStr),
        catch: () => ({
          response: new Response("Invalid URL", {
            status: HttpStatus.BadRequest,
          }),
        }),
      });

      if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
        return yield* Effect.fail({
          response: new Response("Domain not allowed", {
            status: HttpStatus.Forbidden,
          }),
        });
      }

      return parsed;
    });

  const fetchImage = (validUrl: URL) =>
    Effect.tryPromise({
      try: () => fetch(validUrl),
      catch: (cause) => ({
        response: new Response("Failed to fetch image", {
          status: HttpStatus.InternalServerError,
        }),
        cause,
      }),
    }).pipe(
      Effect.flatMap((res) =>
        res.ok
          ? Effect.succeed(res)
          : Effect.fail({
              response: new Response("Failed to fetch image", {
                status: HttpStatus.InternalServerError,
              }),
            }),
      ),
    );

  const processImage = (response: Response) =>
    Effect.tryPromise({
      try: async () => {
        const buffer = await response.arrayBuffer();
        const originalFormat = response.headers.get("content-type");
        const photonImage = PhotonImage.new_from_byteslice(new Uint8Array(buffer));

        const aspectRatio = photonImage.get_height() / photonImage.get_width();
        const height = Math.round(width * aspectRatio);
        const resizedImage = resize(photonImage, width, height, SamplingFilter.Lanczos3);

        const format = requestedFormat || originalFormat?.split("/")[1] || "jpeg";

        let outputBuffer: Uint8Array;
        let contentType: string;

        switch (format) {
          case "png":
            outputBuffer = resizedImage.get_bytes();
            contentType = "image/png";
            break;
          case "webp":
            outputBuffer = resizedImage.get_bytes_webp();
            contentType = "image/webp";
            break;
          default:
            outputBuffer = resizedImage.get_bytes_jpeg(quality);
            contentType = "image/jpeg";
        }
        return { outputBuffer, contentType };
      },
      catch: (cause) => ({
        response: new Response("Failed to process image", {
          status: HttpStatus.InternalServerError,
        }),
        cause,
      }),
    });

  const program = validateUrl(imageUrl).pipe(
    Effect.tap(() =>
      Effect.logInfo(
        `image:request url=${imageUrl ?? ""} width=${width} quality=${quality} format=${requestedFormat ?? ""}`,
      ),
    ),
    Effect.flatMap(fetchImage),
    Effect.flatMap(processImage),
    Effect.tap(({ contentType }) =>
      Effect.logDebug(`image:success contentType=${contentType} width=${width}`),
    ),
    Effect.catch(
      Effect.fn("imageErrorHandler")(function* (error: ImageError) {
        if ("cause" in error) {
          yield* Effect.logError("image:error", error.cause);
        } else {
          yield* Effect.logError("image:error");
        }
        return error.response;
      }),
    ),
  );

  const result = await runSimpleEffect(program);

  if (result instanceof Response) {
    return result;
  }

  const { outputBuffer, contentType } = result;

  return new Response(new Uint8Array(outputBuffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

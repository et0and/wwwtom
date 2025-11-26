import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";
import type { APIEvent } from "@solidjs/start/server";
import { Effect, pipe } from "effect";
import { logger, runServerEffect } from "~/libs/utils/logger";

const ALLOWED_DOMAINS = ["cdn.tom.so"];

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const imageUrl = url.searchParams.get("url");
	const width = parseInt(url.searchParams.get("width") || "800");
	const quality = parseInt(url.searchParams.get("quality") || "85");
	const requestedFormat = url.searchParams.get("format");

	const validateUrl = (urlStr: string | null) =>
		pipe(
			Effect.fromNullable(urlStr),
			Effect.mapError(() => ({
				response: new Response("Missing url parameter", { status: 400 }),
			})),
			Effect.flatMap((url) =>
				Effect.try({
					try: () => new URL(url),
					catch: () => ({
						response: new Response("Invalid URL", { status: 400 }),
					}),
				}),
			),
			Effect.flatMap((parsed) =>
				ALLOWED_DOMAINS.includes(parsed.hostname)
					? Effect.succeed(parsed)
					: Effect.fail({
							response: new Response("Domain not allowed", { status: 403 }),
						}),
			),
		);

	const fetchImage = (validUrl: URL) =>
		pipe(
			Effect.tryPromise({
				try: () => fetch(validUrl),
				catch: (cause) => ({
					response: new Response("Failed to fetch image", { status: 500 }),
					cause,
				}),
			}),
			Effect.flatMap((res) =>
				res.ok
					? Effect.succeed(res)
					: Effect.fail({
							response: new Response("Failed to fetch image", { status: 500 }),
						}),
			),
		);

	const processImage = (response: Response) =>
		Effect.tryPromise({
			try: async () => {
				const buffer = await response.arrayBuffer();
				const originalFormat = response.headers.get("content-type");
				const photonImage = PhotonImage.new_from_byteslice(
					new Uint8Array(buffer),
				);

				const aspectRatio = photonImage.get_height() / photonImage.get_width();
				const height = Math.round(width * aspectRatio);
				const resizedImage = resize(
					photonImage,
					width,
					height,
					SamplingFilter.Lanczos3,
				);

				const format =
					requestedFormat || originalFormat?.split("/")[1] || "jpeg";

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
				response: new Response("Failed to process image", { status: 500 }),
				cause,
			}),
		});

	const program = pipe(
		validateUrl(imageUrl),
		Effect.flatMap(fetchImage),
		Effect.flatMap(processImage),
		Effect.catchAll((error) =>
			Effect.sync(() => {
				if ("cause" in error) {
					logger.error("Image optimization error:", error.cause);
				}
				return error.response;
			}),
		),
	);

	const result = await runServerEffect(program);

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

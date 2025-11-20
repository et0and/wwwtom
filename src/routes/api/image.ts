import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";
import type { APIEvent } from "@solidjs/start/server";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { logger, runServerEffect } from "~/libs/utils/logger";
import { ImageError } from "~/libs/types/errors/ImageError";

const ALLOWED_DOMAINS = ["cdn.tom.so"];

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const imageUrl = url.searchParams.get("url");
	const width = parseInt(url.searchParams.get("width") || "800");
	const quality = parseInt(url.searchParams.get("quality") || "85");
	const requestedFormat = url.searchParams.get("format");

	const validateUrl = (urlStr: string | null): Result<URL, ImageError> => {
		if (!urlStr) {
			return err({
				response: new Response("Missing url parameter", { status: 400 }),
			});
		}
		return Result.fromThrowable(
			() => new URL(urlStr),
			() => ({ response: new Response("Invalid URL", { status: 400 }) }),
		)().andThen((parsed) => {
			if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
				return err({
					response: new Response("Domain not allowed", { status: 403 }),
				});
			}
			return ok(parsed);
		});
	};

	const fetchImage = (validUrl: URL): ResultAsync<Response, ImageError> => {
		return ResultAsync.fromPromise(fetch(validUrl), (cause) => ({
			response: new Response("Failed to fetch image", { status: 500 }),
			cause,
		})).andThen((res) => {
			if (!res.ok) {
				return err({
					response: new Response("Failed to fetch image", { status: 500 }),
				});
			}
			return ok(res);
		});
	};

	const processImage = (
		response: Response,
	): ResultAsync<
		{ outputBuffer: Uint8Array; contentType: string },
		ImageError
	> => {
		return ResultAsync.fromPromise(
			(async () => {
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
			})(),
			(cause) => ({
				response: new Response("Failed to process image", { status: 500 }),
				cause,
			}),
		);
	};

	const result = await validateUrl(imageUrl)
		.asyncAndThen(fetchImage)
		.andThen(processImage);

	if (result.isErr()) {
		const { response, cause } = result.error;
		if (cause) {
			await runServerEffect(logger.error("Image optimization error:", cause));
		}
		return response;
	}

	const { outputBuffer, contentType } = result.value;

	return new Response(new Uint8Array(outputBuffer), {
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

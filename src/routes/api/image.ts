import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";
import type { APIEvent } from "@solidjs/start/server";

const ALLOWED_DOMAINS = ["cdn.tom.so"];

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const imageUrl = url.searchParams.get("url");
	const width = parseInt(url.searchParams.get("width") || "800");
	const quality = parseInt(url.searchParams.get("quality") || "85");

	if (!imageUrl) {
		return new Response("Missing url parameter", { status: 400 });
	}

	let imageUrlParsed: URL;
	try {
		imageUrlParsed = new URL(imageUrl);
	} catch {
		return new Response("Invalid URL", { status: 400 });
	}

	if (!ALLOWED_DOMAINS.includes(imageUrlParsed.hostname)) {
		return new Response("Domain not allowed", { status: 403 });
	}

	try {
		const response = await fetch(imageUrl);

		if (!response.ok) {
			return new Response("Failed to fetch image", { status: 500 });
		}

		const buffer = await response.arrayBuffer();
		const originalFormat = response.headers.get("content-type");

		const photonImage = PhotonImage.new_from_byteslice(new Uint8Array(buffer));

		const aspectRatio = photonImage.get_height() / photonImage.get_width();
		const height = Math.round(width * aspectRatio);
		const resizedImage = resize(
			photonImage,
			width,
			height,
			SamplingFilter.Lanczos3,
		);

		const format =
			url.searchParams.get("format") || originalFormat?.split("/")[1] || "jpeg";

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

		return new Response(new Uint8Array(outputBuffer), {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (error) {
		console.error("Image optimization error:", error);
		return new Response("Failed to process image", { status: 500 });
	}
}

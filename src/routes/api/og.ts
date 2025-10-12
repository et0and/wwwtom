import type { APIEvent } from "@solidjs/start/server";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

let wasmInitialized = false;

const libreCaslonRegular = fetch(
	"https://cdn.tom.so/LibreCaslonCondensed-Regular.woff2",
).then((res) => res.arrayBuffer());

const libreCaslonMedium = fetch(
	"https://cdn.tom.so/LibreCaslonCondensed-Medium.woff2",
).then((res) => res.arrayBuffer());

export async function GET({ request }: APIEvent) {
	if (!wasmInitialized) {
		const wasmUrl = new URL("/resvg.wasm", request.url).href;
		await initWasm(fetch(wasmUrl));
		wasmInitialized = true;
	}

	const { searchParams } = new URL(request.url);
	const title = searchParams.get("title");

	const [libreCaslonRegularData, libreCaslonMediumData] = await Promise.all([
		libreCaslonRegular,
		libreCaslonMedium,
	]);

	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "white",
				},
				children: {
					type: "div",
					props: {
						style: {
							height: "100%",
							width: "100%",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: "white",
						},
						children: {
							type: "div",
							props: {
								style: {
									display: "flex",
									paddingLeft: "2rem",
								},
								children: {
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
											width: "100%",
											paddingTop: "3rem",
											paddingBottom: "3rem",
											paddingLeft: "1rem",
											paddingRight: "1rem",
											justifyContent: "space-between",
											padding: "2rem",
										},
										children: {
											type: "h2",
											props: {
												style: {
													display: "flex",
													flexDirection: "column",
													fontSize: "2.25rem",
													fontWeight: 500,
													letterSpacing: "-0.025em",
													color: "#111827",
													textAlign: "left",
												},
												children: [
													{
														type: "span",
														props: {
															children: title,
														},
													},
													{
														type: "span",
														props: {
															style: {
																color: "#4B5563",
																fontSize: "1.125rem",
															},
															children: "Tom Hackshaw",
														},
													},
												],
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: "Libre Caslon Condensed",
					data: libreCaslonRegularData,
					style: "normal",
					weight: 400,
				},
				{
					name: "Libre Caslon Condensed",
					data: libreCaslonMediumData,
					style: "normal",
					weight: 500,
				},
			],
		},
	);

	const resvg = new Resvg(svg);
	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	return new Response(new Uint8Array(pngBuffer), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

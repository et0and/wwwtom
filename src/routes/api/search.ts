import { OramaClient } from "@oramacloud/client";
import { APIEvent } from "@solidjs/start/server";

export async function POST({ request, nativeEvent }: APIEvent) {
	try {
		const { term, limit = 3, mode = "hybrid" } = await request.json();

		if (!term) {
			return new Response(
				JSON.stringify({ error: "Search term is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const env = nativeEvent.context.cloudflare?.env as
			| { ORAMA_API_KEY?: string; ORAMA_ENDPOINT?: string }
			| undefined;

		const endpoint = env?.ORAMA_ENDPOINT;
		const api_key = env?.ORAMA_API_KEY;

		if (!endpoint || !api_key) {
			console.error("Missing Orama configuration");
			return new Response(
				JSON.stringify({
					error: "Search service is not properly configured",
				}),
				{ status: 503, headers: { "Content-Type": "application/json" } },
			);
		}

		const client = new OramaClient({
			endpoint,
			api_key,
		});

		const results = await client.search({
			term,
			limit,
			mode,
		});

		return new Response(JSON.stringify(results), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Search error:", error);
		return new Response(JSON.stringify({ error: "Search failed" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

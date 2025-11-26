import { OramaClient } from "@oramacloud/client";
import { APIEvent } from "@solidjs/start/server";
import { Effect } from "effect";
import { SearchBody } from "~/libs/types/search";

interface Env {
	ORAMA_API_KEY?: string;
	ORAMA_ENDPOINT?: string;
}

export function POST({ request, nativeEvent }: APIEvent) {
	const program = Effect.gen(function* () {
		const body = yield* Effect.tryPromise({
			try: () => request.json() as Promise<SearchBody>,
			catch: (e) => ({
				status: 400,
				message: "Invalid JSON",
				error: e,
			}),
		});

		const { term, limit = 3, mode = "hybrid" } = body;

		if (!term) {
			return yield* Effect.fail({
				status: 400,
				message: "Search term is required",
			});
		}

		const env = nativeEvent.context.cloudflare?.env as Env | undefined;
		const endpoint = env?.ORAMA_ENDPOINT;
		const api_key = env?.ORAMA_API_KEY;

		if (!endpoint || !api_key) {
			return yield* Effect.fail({
				status: 503,
				message: "Search service is not properly configured",
				log: "Missing Orama configuration",
			});
		}

		const client = new OramaClient({ endpoint, api_key });
		const results = yield* Effect.tryPromise({
			try: () => client.search({ term, limit, mode }),
			catch: (e) => ({
				status: 500,
				message: "Search failed",
				error: e,
				log: "Search error",
			}),
		});

		return results;
	});

	return Effect.runPromise(
		program.pipe(
			Effect.catchAll((error) => {
				if ("log" in error && error.log) {
					const args = "error" in error ? [error.error] : [];
					return Effect.gen(function* () {
						yield* Effect.logError(String(error.log), ...args);
						return new Response(JSON.stringify({ error: error.message }), {
							status: error.status,
							headers: { "Content-Type": "application/json" },
						});
					});
				}

				return Effect.succeed(
					new Response(JSON.stringify({ error: error.message }), {
						status: error.status,
						headers: { "Content-Type": "application/json" },
					}),
				);
			}),
			Effect.map(
				(results) =>
					new Response(JSON.stringify(results), {
						headers: { "Content-Type": "application/json" },
					}),
			),
		),
	);
}

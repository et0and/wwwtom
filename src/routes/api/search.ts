import { OramaClient } from "@oramacloud/client";
import { APIEvent } from "@solidjs/start/server";
import { err, fromPromise, ok } from "neverthrow";
import { logger, runServerEffect } from "~/libs/utils/logger";
import { SearchBody } from "~/libs/types/search";

interface Env {
	ORAMA_API_KEY?: string;
	ORAMA_ENDPOINT?: string;
}

export function POST({ request, nativeEvent }: APIEvent) {
	return fromPromise(request.json() as Promise<SearchBody>, (e) => ({
		status: 400,
		message: "Invalid JSON",
		error: e,
	}))
		.andThen((body) => {
			const { term, limit = 3, mode = "hybrid" } = body;

			if (!term) {
				return err({
					status: 400,
					message: "Search term is required",
				});
			}

			return ok({ term, limit, mode });
		})
		.andThen((params) => {
			const env = nativeEvent.context.cloudflare?.env as Env | undefined;
			const endpoint = env?.ORAMA_ENDPOINT;
			const api_key = env?.ORAMA_API_KEY;

			if (!endpoint || !api_key) {
				return err({
					status: 503,
					message: "Search service is not properly configured",
					log: "Missing Orama configuration",
				});
			}

			return ok({
				client: new OramaClient({ endpoint, api_key }),
				params,
			});
		})
		.andThen(({ client, params }) =>
			fromPromise(client.search(params), (e) => ({
				status: 500,
				message: "Search failed",
				error: e,
				log: "Search error",
			})),
		)
		.match(
			(results) =>
				new Response(JSON.stringify(results), {
					headers: { "Content-Type": "application/json" },
				}),
			async (error) => {
				if ("log" in error && error.log) {
					const args = "error" in error ? [error.error] : [];
					await runServerEffect(logger.error(error.log, ...args));
				}

				return new Response(JSON.stringify({ error: error.message }), {
					status: error.status,
					headers: { "Content-Type": "application/json" },
				});
			},
		);
}

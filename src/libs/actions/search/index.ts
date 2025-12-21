import { OramaClient } from "@oramacloud/client";
import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { logger } from "~/libs/utils/logger";
import type { SearchParams, SearchResult } from "~/libs/types/search";

interface Env {
	ORAMA_API_KEY?: string;
	ORAMA_ENDPOINT?: string;
}

export function performSearch(
	params: SearchParams,
): Effect.Effect<SearchResult | null, Error> {
	"use server";

	return Effect.gen(function* () {
		const { term, limit = 3, mode = "hybrid" } = params;

		if (!term) {
			return yield* Effect.fail(new Error("Search term is required"));
		}

		const event = getRequestEvent();
		const env = event?.nativeEvent.context.cloudflare?.env as Env | undefined;

		const endpoint = env?.ORAMA_ENDPOINT;
		const api_key = env?.ORAMA_API_KEY;

		if (!endpoint || !api_key) {
			yield* Effect.sync(() =>
				logger.error("Search service is not properly configured"),
			);
			return yield* Effect.fail(
				new Error("Search service is not properly configured"),
			);
		}

		yield* Effect.sync(() => logger.debug(`Searching for: ${term}`));

		const client = new OramaClient({ endpoint, api_key });

		const results = yield* Effect.tryPromise({
			try: () => client.search({ term, limit, mode }),
			catch: (e) => (e instanceof Error ? e : new Error("Search failed")),
		});

		return results;
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => logger.error("Search error", error)),
		),
	);
}

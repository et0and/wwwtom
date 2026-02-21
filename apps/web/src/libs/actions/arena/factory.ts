"use server";

import { query } from "@solidjs/router";
import { Effect } from "effect";
import { ArenaService, type ArenaServiceShape } from "@tom/arena/service";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

export type ArenaCall<T> = (arena: ArenaServiceShape) => Effect.Effect<T, unknown>;

export const createArenaQuery = <T, Args extends unknown[]>(
	name: string,
	cacheKey: string,
	makeCall: (...args: Args) => ArenaCall<T>,
	getLogId: (...args: Args) => string | number = () => "",
) =>
	query(async (...args: Args) => {
		"use server";
		const layer = getServiceLayer();
		const logId = getLogId(...args);
		const logPrefix = logId ? `${name}:${logId}` : name;
		return runEffect(
			Effect.gen(function* () {
				const arena = yield* ArenaService;
				yield* Effect.logInfo(`${logPrefix}:start`);
				const result = yield* makeCall(...args)(arena).pipe(Effect.retry(retryPolicy));
				yield* Effect.logInfo(`${logPrefix}:success`);
				return result;
			}),
			layer,
		);
	}, cacheKey);

import { getRequestEvent } from "solid-js/web";
import { Effect, Redacted } from "effect";
import { logger } from "~/libs/utils/logger";
import { retryPolicy } from "~/libs/utils/retry";

export function fetchPayload<T>(
	endpoint: string,
	options?: RequestInit & { cache?: boolean; cacheTTL?: number },
): Effect.Effect<T, Error> {
	"use server";

	return Effect.gen(function* () {
		const event = getRequestEvent();
		const env = event?.nativeEvent.context.cloudflare?.env as
			| { PAYLOAD_URL?: string }
			| undefined;

		const payloadUrlValue =
			env?.PAYLOAD_URL ||
			(typeof process !== "undefined" ? process.env?.PAYLOAD_URL : undefined) ||
			import.meta.env.PAYLOAD_URL;

		if (!payloadUrlValue) {
			const error = new Error("PAYLOAD_URL environment variable is not set");
			yield* Effect.sync(() => logger.error("Configuration error", error));
			return yield* Effect.fail(error);
		}

		const PAYLOAD_URL = Redacted.make(payloadUrlValue);
		const url = `${Redacted.value(PAYLOAD_URL)}/api${endpoint}`;

		const headers: HeadersInit = {
			"Content-Type": "application/json",
			Origin:
				Redacted.value(PAYLOAD_URL)?.replace("/api", "") ||
				"http://localhost:3000",
			Referer:
				Redacted.value(PAYLOAD_URL)?.replace("/api", "") ||
				"http://localhost:3000",
			...options?.headers,
		};

		yield* Effect.sync(() => logger.debug(`Fetching Payload: ${url}`));

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch(url, {
					...options,
					headers,
				}),
			catch: (e) => (e instanceof Error ? e : new Error("Unknown fetch error")),
		});

		if (!response.ok) {
			return yield* Effect.fail(
				new Error(
					`Payload API error: ${response.status} ${response.statusText}`,
				),
			);
		}

		const data = yield* Effect.tryPromise({
			try: () => response.json(),
			catch: (e) => (e instanceof Error ? e : new Error("JSON parse error")),
		});

		return data as T;
	}).pipe(
		Effect.retry(retryPolicy),
		Effect.mapError((error: Error) => {
			const event = getRequestEvent();
			const env = event?.nativeEvent.context.cloudflare?.env as
				| { PAYLOAD_URL?: string }
				| undefined;
			const payloadUrlValue =
				env?.PAYLOAD_URL ||
				(typeof process !== "undefined"
					? process.env?.PAYLOAD_URL
					: undefined) ||
				import.meta.env.PAYLOAD_URL;
			const url = `${payloadUrlValue || ""}/api${endpoint}`;
			logger.error(`Payload fetch error: ${url}`, error);
			return error;
		}),
	);
}

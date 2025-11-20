import { getRequestEvent } from "solid-js/web";
import { ResultAsync, errAsync } from "neverthrow";

/**
 * Basic client for interacting with my Payload CMS instance.
 */
export function fetchPayload<T>(
	endpoint: string,
	options?: RequestInit & { cache?: boolean; cacheTTL?: number },
): ResultAsync<T, Error> {
	"use server";

	const event = getRequestEvent();
	const env = event?.nativeEvent.context.cloudflare?.env as
		| { PAYLOAD_URL?: string }
		| undefined;

	const PAYLOAD_URL: string =
		env?.PAYLOAD_URL || process.env.PAYLOAD_URL || import.meta.env.PAYLOAD_URL;

	if (!PAYLOAD_URL) {
		return errAsync(new Error("PAYLOAD_URL environment variable is not set"));
	}

	const url = `${PAYLOAD_URL}/api${endpoint}`;

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		Origin: PAYLOAD_URL?.replace("/api", "") || "http://localhost:3000",
		Referer: PAYLOAD_URL?.replace("/api", "") || "http://localhost:3000",
		...options?.headers,
	};

	return ResultAsync.fromPromise(
		fetch(url, {
			...options,
			headers,
		}),
		(e) => (e instanceof Error ? e : new Error("Unknown fetch error")),
	).andThen((response) => {
		if (!response.ok) {
			return errAsync(
				new Error(
					`Payload API error: ${response.status} ${response.statusText}`,
				),
			);
		}

		return ResultAsync.fromPromise(response.json(), (e) =>
			e instanceof Error ? e : new Error("JSON parse error"),
		).map((data) => data as T);
	});
}

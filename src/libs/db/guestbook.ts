import { Effect } from "effect";
import postgres from "postgres";
import { getRequestEvent } from "solid-js/web";
import { retryPolicy } from "../utils/retry";
import {
	DatabaseConnectionError,
	GuestbookValidationError,
	OAuthSessionError,
} from "../types/errors";
import { GuestbookEntry, OAuthSession } from "./types";

const getConnection = () =>
	Effect.gen(function* () {
		const event = getRequestEvent();
		const env = event?.nativeEvent.context.cloudflare?.env as
			| {
					HYPERDRIVE?: { connectionString: string };
			  }
			| undefined;

		yield* Effect.logDebug("Cloudflare env available", { hasEnv: !!env });
		yield* Effect.logDebug("Hyperdrive binding available", {
			hasHyperdrive: !!env?.HYPERDRIVE,
		});

		if (env?.HYPERDRIVE) {
			yield* Effect.logDebug("Using Hyperdrive connection", {
				connectionString: env.HYPERDRIVE.connectionString,
			});
		}

		const connectionString =
			env?.HYPERDRIVE?.connectionString ||
			(typeof process !== "undefined" ? process.env?.DATABASE_URL : undefined);

		if (!connectionString) {
			return yield* Effect.fail(
				new DatabaseConnectionError({
					message: "HYPERDRIVE binding not available and DATABASE_URL not set",
				}),
			);
		}

		return postgres(connectionString);
	});

export const createGuestbookEntry = (params: {
	fediverse_username: string;
	fediverse_instance: string;
	display_name: string | null;
	avatar_url: string | null;
	message: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();

		const result = yield* Effect.tryPromise({
			try: async () =>
				await sql<GuestbookEntry[]>`
					INSERT INTO guestbook_entries (
						fediverse_username,
						fediverse_instance,
						display_name,
						avatar_url,
						message
					)
					VALUES (
						${params.fediverse_username},
						${params.fediverse_instance},
						${params.display_name},
						${params.avatar_url},
						${params.message}
					)
					RETURNING *
				`,
			catch: (error) =>
				new GuestbookValidationError({
					message: `Failed to create guestbook entry: ${error}`,
				}),
		});

		return result[0];
	}).pipe(Effect.retry(retryPolicy));

export const getGuestbookEntries = (params: {
	page?: number;
	page_size?: number;
}) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();
		const page = params.page ?? 1;
		const pageSize = params.page_size ?? 100;
		const offset = (page - 1) * pageSize;

		const [results, totalCountResult] = yield* Effect.all([
			Effect.tryPromise({
				try: async () =>
					await sql<GuestbookEntry[]>`
						SELECT *
						FROM guestbook_entries
						ORDER BY created_at DESC
						LIMIT ${pageSize}
						OFFSET ${offset}
					`,
				catch: (error) =>
					new GuestbookValidationError({
						message: `Failed to get guestbook entries: ${error}`,
					}),
			}),
			Effect.tryPromise({
				try: async () =>
					await sql<{ count: string }[]>`
						SELECT COUNT(*) as count
						FROM guestbook_entries
					`,
				catch: (error) =>
					new GuestbookValidationError({
						message: `Failed to get guestbook count: ${error}`,
					}),
			}),
		]);

		return {
			results,
			page,
			page_size: pageSize,
			total_count: parseInt(totalCountResult[0]?.count || "0"),
		};
	}).pipe(Effect.retry(retryPolicy));

export const hasUserSigned = (fediverse_username: string) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();

		const result = yield* Effect.tryPromise({
			try: async () =>
				await sql<{ count: string }[]>`
					SELECT COUNT(*) as count
					FROM guestbook_entries
					WHERE fediverse_username = ${fediverse_username}
				`,
			catch: (error) =>
				new GuestbookValidationError({
					message: `Failed to check if user signed: ${error}`,
				}),
		});

		return parseInt(result[0]?.count || "0") > 0;
	}).pipe(Effect.retry(retryPolicy));

export const createOAuthSession = (params: {
	session_token: string;
	fediverse_instance: string;
	client_id: string;
	client_secret: string;
	state: string;
	code_verifier: string | null;
	expires_at: Date;
}) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();

		const result = yield* Effect.tryPromise({
			try: async () =>
				await sql<OAuthSession[]>`
					INSERT INTO oauth_sessions (
						session_token,
						fediverse_instance,
						client_id,
						client_secret,
						state,
						code_verifier,
						expires_at
					)
					VALUES (
						${params.session_token},
						${params.fediverse_instance},
						${params.client_id},
						${params.client_secret},
						${params.state},
						${params.code_verifier},
						${params.expires_at}
					)
					RETURNING *
				`,
			catch: (error) =>
				new OAuthSessionError({
					message: `Failed to create OAuth session: ${error}`,
					sessionToken: params.session_token,
				}),
		});

		return result[0];
	}).pipe(Effect.retry(retryPolicy));

export const getOAuthSession = (session_token: string) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();

		const result = yield* Effect.tryPromise({
			try: async () =>
				await sql<OAuthSession[]>`
					SELECT *
					FROM oauth_sessions
					WHERE session_token = ${session_token}
					AND expires_at > CURRENT_TIMESTAMP
					LIMIT 1
				`,
			catch: (error) =>
				new OAuthSessionError({
					message: `Failed to get OAuth session: ${error}`,
					sessionToken: session_token,
				}),
		});

		return result[0] || null;
	}).pipe(Effect.retry(retryPolicy));

export const deleteOAuthSession = (session_token: string) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();

		const deletedCount = yield* Effect.tryPromise({
			try: async () => {
				const result = await sql`
					DELETE FROM oauth_sessions
					WHERE session_token = ${session_token}
				`;
				return result.count;
			},
			catch: (error) =>
				new OAuthSessionError({
					message: `Failed to delete OAuth session: ${error}`,
					sessionToken: session_token,
				}),
		});

		return deletedCount;
	}).pipe(Effect.retry(retryPolicy));

export const cleanupExpiredSessions = () =>
	Effect.gen(function* () {
		const sql = yield* getConnection();

		const deletedCount = yield* Effect.tryPromise({
			try: async () => {
				const result = await sql`
					DELETE FROM oauth_sessions
					WHERE expires_at < CURRENT_TIMESTAMP
				`;
				return result.count;
			},
			catch: (error) =>
				new OAuthSessionError({
					message: `Failed to cleanup expired sessions: ${error}`,
				}),
		});

		return deletedCount;
	}).pipe(Effect.retry(retryPolicy));

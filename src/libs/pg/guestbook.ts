import { Effect } from "effect";
import postgres from "postgres";
import { getRequestEvent } from "solid-js/web";
import { retryPolicy } from "../utils/retry";
import {
	DatabaseConnectionError,
	GuestbookValidationError,
	OAuthSessionError,
	StoredProcedureError,
} from "../types/errors";

export interface GuestbookEntry {
	id: number;
	fediverse_username: string;
	fediverse_instance: string;
	display_name: string | null;
	avatar_url: string | null;
	message: string;
	created_at: Date;
	updated_at: Date;
}

export interface OAuthSession {
	id: number;
	session_token: string;
	fediverse_instance: string;
	client_id: string;
	client_secret: string;
	state: string;
	code_verifier: string | null;
	created_at: Date;
	expires_at: Date;
}

interface StoredProcedureResult<T> {
	success: boolean;
	error?: string;
	data?: T;
	results?: T[];
	page?: number;
	page_size?: number;
	total_count?: number;
	has_signed?: boolean;
	deleted_count?: number;
}

const getConnection = () =>
	Effect.try({
		try: () => {
			const event = getRequestEvent();
			const env = event?.nativeEvent.context.cloudflare?.env as
				| { HYPERDRIVE?: Hyperdrive }
				| undefined;

			const connectionString =
				env?.HYPERDRIVE?.connectionString ||
				(typeof process !== "undefined"
					? process.env?.DATABASE_URL
					: undefined);

			if (!connectionString) {
				throw new DatabaseConnectionError({
					message: "HYPERDRIVE binding not available and DATABASE_URL not set",
				});
			}

			return postgres(connectionString);
		},
		catch: (error) => {
			if (error instanceof DatabaseConnectionError) return error;
			return new DatabaseConnectionError({
				message: "Failed to connect to database",
				cause: error,
			});
		},
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
			try: async () => {
				const rows = await sql`SELECT usp_create_guestbook_entry(
					${params.fediverse_username},
					${params.fediverse_instance},
					${params.display_name},
					${params.avatar_url},
					${params.message}
				)`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_create_guestbook_entry",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0]
					.usp_create_guestbook_entry as StoredProcedureResult<GuestbookEntry>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_create_guestbook_entry",
					message: "Failed to create guestbook entry",
					cause: error,
				});
			},
		});

		if (!result.success) {
			return yield* Effect.fail(
				new GuestbookValidationError({
					message: result.error ?? "Unknown error creating guestbook entry",
				}),
			);
		}

		if (!result.data) {
			return yield* Effect.fail(
				new StoredProcedureError({
					procedure: "usp_create_guestbook_entry",
					message: "No data returned from stored procedure",
				}),
			);
		}

		return result.data;
	}).pipe(Effect.retry(retryPolicy));

export const getGuestbookEntries = (params: {
	page?: number;
	page_size?: number;
}) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();
		const page = params.page ?? 1;
		const pageSize = params.page_size ?? 100;

		const result = yield* Effect.tryPromise({
			try: async () => {
				const rows =
					await sql`SELECT usp_get_guestbook_entries(${page}, ${pageSize})`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_get_guestbook_entries",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0]
					.usp_get_guestbook_entries as StoredProcedureResult<GuestbookEntry>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_get_guestbook_entries",
					message: "Failed to get guestbook entries",
					cause: error,
				});
			},
		});

		if (!result.success) {
			return yield* Effect.fail(
				new GuestbookValidationError({
					message: result.error ?? "Unknown error getting guestbook entries",
				}),
			);
		}

		if (!result.results) {
			return yield* Effect.fail(
				new StoredProcedureError({
					procedure: "usp_get_guestbook_entries",
					message: "No results returned from stored procedure",
				}),
			);
		}

		return {
			results: result.results,
			page: result.page ?? page,
			page_size: result.page_size ?? pageSize,
			total_count: result.total_count ?? 0,
		};
	}).pipe(Effect.retry(retryPolicy));

export const hasUserSigned = (fediverse_username: string) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();
		const result = yield* Effect.tryPromise({
			try: async () => {
				const rows =
					await sql`SELECT usp_has_user_signed(${fediverse_username})`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_has_user_signed",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0].usp_has_user_signed as StoredProcedureResult<never>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_has_user_signed",
					message: "Failed to check if user signed",
					cause: error,
				});
			},
		});

		if (!result.success) {
			return yield* Effect.fail(
				new GuestbookValidationError({
					message: result.error ?? "Unknown error checking user signature",
				}),
			);
		}

		if (result.has_signed === undefined) {
			return yield* Effect.fail(
				new StoredProcedureError({
					procedure: "usp_has_user_signed",
					message: "No has_signed field returned from stored procedure",
				}),
			);
		}

		return result.has_signed;
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
			try: async () => {
				const rows = await sql`SELECT usp_create_oauth_session(
					${params.session_token},
					${params.fediverse_instance},
					${params.client_id},
					${params.client_secret},
					${params.state},
					${params.code_verifier},
					${params.expires_at}
				)`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_create_oauth_session",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0]
					.usp_create_oauth_session as StoredProcedureResult<OAuthSession>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_create_oauth_session",
					message: "Failed to create OAuth session",
					cause: error,
				});
			},
		});

		if (!result.success) {
			return yield* Effect.fail(
				new OAuthSessionError({
					message: result.error ?? "Unknown error creating OAuth session",
					sessionToken: params.session_token,
				}),
			);
		}

		if (!result.data) {
			return yield* Effect.fail(
				new StoredProcedureError({
					procedure: "usp_create_oauth_session",
					message: "No data returned from stored procedure",
				}),
			);
		}

		return result.data;
	}).pipe(Effect.retry(retryPolicy));

export const getOAuthSession = (session_token: string) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();
		const result = yield* Effect.tryPromise({
			try: async () => {
				const rows = await sql`SELECT usp_get_oauth_session(${session_token})`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_get_oauth_session",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0]
					.usp_get_oauth_session as StoredProcedureResult<OAuthSession>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_get_oauth_session",
					message: "Failed to get OAuth session",
					cause: error,
				});
			},
		});

		if (!result.success || !result.data) {
			return undefined;
		}

		return result.data;
	}).pipe(Effect.retry(retryPolicy));

export const deleteOAuthSession = (session_token: string) =>
	Effect.gen(function* () {
		const sql = yield* getConnection();
		const result = yield* Effect.tryPromise({
			try: async () => {
				const rows =
					await sql`SELECT usp_delete_oauth_session(${session_token})`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_delete_oauth_session",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0].usp_delete_oauth_session as StoredProcedureResult<never>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_delete_oauth_session",
					message: "Failed to delete OAuth session",
					cause: error,
				});
			},
		});

		if (!result.success) {
			return yield* Effect.fail(
				new OAuthSessionError({
					message: result.error ?? "Unknown error deleting OAuth session",
					sessionToken: session_token,
				}),
			);
		}

		if (result.deleted_count === undefined) {
			return yield* Effect.fail(
				new StoredProcedureError({
					procedure: "usp_delete_oauth_session",
					message: "No deleted_count returned from stored procedure",
				}),
			);
		}

		return result.deleted_count;
	}).pipe(Effect.retry(retryPolicy));

export const cleanupExpiredSessions = () =>
	Effect.gen(function* () {
		const sql = yield* getConnection();
		const result = yield* Effect.tryPromise({
			try: async () => {
				const rows = await sql`SELECT usp_cleanup_expired_sessions()`;
				if (!rows[0]) {
					throw new StoredProcedureError({
						procedure: "usp_cleanup_expired_sessions",
						message: "No result returned from stored procedure",
					});
				}
				return rows[0]
					.usp_cleanup_expired_sessions as StoredProcedureResult<never>;
			},
			catch: (error) => {
				if (error instanceof StoredProcedureError) return error;
				return new StoredProcedureError({
					procedure: "usp_cleanup_expired_sessions",
					message: "Failed to cleanup expired sessions",
					cause: error,
				});
			},
		});

		if (!result.success) {
			return yield* Effect.fail(
				new OAuthSessionError({
					message: result.error ?? "Unknown error cleaning up expired sessions",
				}),
			);
		}

		if (result.deleted_count === undefined) {
			return yield* Effect.fail(
				new StoredProcedureError({
					procedure: "usp_cleanup_expired_sessions",
					message: "No deleted_count returned from stored procedure",
				}),
			);
		}

		return result.deleted_count;
	}).pipe(Effect.retry(retryPolicy));

import { Effect } from "effect";
import postgres from "postgres";
import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import { retryPolicy } from "@tom/utils/retry";
import {
  DatabaseConnectionError,
  GuestbookValidationError,
  OAuthSessionError,
} from "@tom/types/errors";
import type { Database } from "@tom/types/db";

export type CloudflareEnv = {
  HYPERDRIVE?: { connectionString: string };
};

export type GetConnectionStringFn = () => string | undefined;

const createKyselyConnection = (getConnectionString: GetConnectionStringFn) =>
  Effect.gen(function* () {
    const connectionString = getConnectionString();

    if (!connectionString) {
      return yield* Effect.fail(
        new DatabaseConnectionError({
          message: "HYPERDRIVE binding not available and DATABASE_URL not set",
        }),
      );
    }

    return new Kysely<Database>({
      dialect: new PostgresJSDialect({
        postgres: postgres(connectionString),
      }),
    });
  });

export const createGuestbookEntry = (
  getConnectionString: GetConnectionStringFn,
  params: {
    fediverse_username: string;
    fediverse_instance: string;
    display_name: string | null;
    avatar_url: string | null;
    message: string;
  },
) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);

    const result = yield* Effect.tryPromise({
      try: async () =>
        await db
          .insertInto("guestbook_entries")
          .values({
            fediverse_username: params.fediverse_username,
            fediverse_instance: params.fediverse_instance,
            display_name: params.display_name,
            avatar_url: params.avatar_url,
            message: params.message,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      catch: (error) =>
        new GuestbookValidationError({
          message: `Failed to create guestbook entry: ${error}`,
        }),
    });

    return result;
  }).pipe(Effect.retry(retryPolicy));

export const getGuestbookEntries = (
  getConnectionString: GetConnectionStringFn,
  params: { page?: number; page_size?: number },
) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 100;
    const offset = (page - 1) * pageSize;

    const [results, totalCountResult] = yield* Effect.all([
      Effect.tryPromise({
        try: async () =>
          await db
            .selectFrom("guestbook_entries")
            .selectAll()
            .orderBy("created_at", "desc")
            .limit(pageSize)
            .offset(offset)
            .execute(),
        catch: (error) =>
          new GuestbookValidationError({
            message: `Failed to get guestbook entries: ${error}`,
          }),
      }),
      Effect.tryPromise({
        try: async () =>
          await db
            .selectFrom("guestbook_entries")
            .select(({ fn }) => [fn.count("id").as("count")])
            .executeTakeFirstOrThrow(),
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
      total_count: Number(totalCountResult.count),
    };
  }).pipe(Effect.retry(retryPolicy));

export const hasUserSigned = (
  getConnectionString: GetConnectionStringFn,
  fediverse_username: string,
) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);

    const result = yield* Effect.tryPromise({
      try: async () =>
        await db
          .selectFrom("guestbook_entries")
          .select(({ fn }) => [fn.count("id").as("count")])
          .where("fediverse_username", "=", fediverse_username)
          .executeTakeFirstOrThrow(),
      catch: (error) =>
        new GuestbookValidationError({
          message: `Failed to check if user signed: ${error}`,
        }),
    });

    return Number(result.count) > 0;
  }).pipe(Effect.retry(retryPolicy));

export const createOAuthSession = (
  getConnectionString: GetConnectionStringFn,
  params: {
    session_token: string;
    fediverse_instance: string;
    client_id: string;
    client_secret: string;
    state: string;
    code_verifier: string | null;
    expires_at: Date;
  },
) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);

    const result = yield* Effect.tryPromise({
      try: async () =>
        await db
          .insertInto("oauth_sessions")
          .values({
            session_token: params.session_token,
            fediverse_instance: params.fediverse_instance,
            client_id: params.client_id,
            client_secret: params.client_secret,
            state: params.state,
            code_verifier: params.code_verifier,
            expires_at: params.expires_at.toISOString(),
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      catch: (error) =>
        new OAuthSessionError({
          message: `Failed to create OAuth session: ${error}`,
          sessionToken: params.session_token,
        }),
    });

    return result;
  }).pipe(Effect.retry(retryPolicy));

export const getOAuthSession = (
  getConnectionString: GetConnectionStringFn,
  session_token: string,
) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);

    const result = yield* Effect.tryPromise({
      try: async () =>
        await db
          .selectFrom("oauth_sessions")
          .selectAll()
          .where("session_token", "=", session_token)
          .where("expires_at", ">", new Date())
          .limit(1)
          .executeTakeFirst(),
      catch: (error) =>
        new OAuthSessionError({
          message: `Failed to get OAuth session: ${error}`,
          sessionToken: session_token,
        }),
    });

    return result || null;
  }).pipe(Effect.retry(retryPolicy));

export const deleteOAuthSession = (
  getConnectionString: GetConnectionStringFn,
  session_token: string,
) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);

    const result = yield* Effect.tryPromise({
      try: async () =>
        await db
          .deleteFrom("oauth_sessions")
          .where("session_token", "=", session_token)
          .executeTakeFirst(),
      catch: (error) =>
        new OAuthSessionError({
          message: `Failed to delete OAuth session: ${error}`,
          sessionToken: session_token,
        }),
    });

    return Number(result.numDeletedRows);
  }).pipe(Effect.retry(retryPolicy));

export const cleanupExpiredSessions = (getConnectionString: GetConnectionStringFn) =>
  Effect.gen(function* () {
    const db = yield* createKyselyConnection(getConnectionString);

    const result = yield* Effect.tryPromise({
      try: async () =>
        await db
          .deleteFrom("oauth_sessions")
          .where("expires_at", "<", new Date())
          .executeTakeFirst(),
      catch: (error) =>
        new OAuthSessionError({
          message: `Failed to cleanup expired sessions: ${error}`,
        }),
    });

    return Number(result.numDeletedRows);
  }).pipe(Effect.retry(retryPolicy));

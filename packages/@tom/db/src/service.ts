import { Context, Effect, Layer, Redacted } from "effect";
import postgres from "postgres";
import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import { retryPolicy } from "@tom/utils/retry";
import { AppConfig } from "@tom/utils/services";
import {
  DatabaseConnectionError,
  GuestbookValidationError,
  OAuthSessionError,
} from "@tom/types/errors";
import type { Database } from "@tom/types/db";
import type { Selectable } from "kysely";

export type GuestbookEntryParams = {
  fediverse_username: string;
  fediverse_instance: string;
  display_name: string | null;
  avatar_url: string | null;
  message: string;
};

export type OAuthSessionParams = {
  session_token: string;
  fediverse_instance: string;
  client_id: string;
  client_secret: string;
  state: string;
  code_verifier: string | null;
  expires_at: Date;
};

export type GuestbookEntry = Selectable<Database["guestbook_entries"]>;
export type OAuthSession = Selectable<Database["oauth_sessions"]>;

export interface DatabaseServiceShape {
  readonly createGuestbookEntry: (
    params: GuestbookEntryParams,
  ) => Effect.Effect<GuestbookEntry, GuestbookValidationError>;

  readonly getGuestbookEntries: (params: { page?: number; page_size?: number }) => Effect.Effect<
    {
      results: readonly GuestbookEntry[];
      page: number;
      page_size: number;
      total_count: number;
    },
    GuestbookValidationError
  >;

  readonly hasUserSigned: (
    fediverse_username: string,
  ) => Effect.Effect<boolean, GuestbookValidationError>;

  readonly createOAuthSession: (
    params: OAuthSessionParams,
  ) => Effect.Effect<OAuthSession, OAuthSessionError>;

  readonly getOAuthSession: (
    session_token: string,
  ) => Effect.Effect<OAuthSession | null, OAuthSessionError>;

  readonly deleteOAuthSession: (session_token: string) => Effect.Effect<number, OAuthSessionError>;

  readonly cleanupExpiredSessions: () => Effect.Effect<number, OAuthSessionError>;
}

// Create Kysely connection from connection string
const createConnection = (
  connectionString: string,
): Effect.Effect<Kysely<Database>, DatabaseConnectionError> =>
  Effect.try({
    try: () =>
      new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: postgres(connectionString),
        }),
      }),
    catch: (error) =>
      new DatabaseConnectionError({
        message: `Failed to create database connection: ${error}`,
      }),
  });

export class DatabaseService extends Context.Service<DatabaseService, DatabaseServiceShape>()(
  "DatabaseService",
) {
  static readonly Default = Layer.effect(
    DatabaseService,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const connectionString = Redacted.value(config.databaseUrl);

      if (!connectionString) {
        return yield* new DatabaseConnectionError({
          message: "Database URL not configured",
        });
      }

      const db = yield* createConnection(connectionString);

      return {
        createGuestbookEntry: Effect.fn("DatabaseService.createGuestbookEntry")(function* (
          params: GuestbookEntryParams,
        ) {
          return yield* Effect.tryPromise({
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
          }).pipe(Effect.retry(retryPolicy));
        }),

        getGuestbookEntries: Effect.fn("DatabaseService.getGuestbookEntries")(function* (params: {
          page?: number;
          page_size?: number;
        }) {
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
          ]).pipe(Effect.retry(retryPolicy));

          return {
            results,
            page,
            page_size: pageSize,
            total_count: Number(totalCountResult.count),
          };
        }),

        hasUserSigned: Effect.fn("DatabaseService.hasUserSigned")(function* (
          fediverse_username: string,
        ) {
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await db
                .selectFrom("guestbook_entries")
                .select(({ fn }) => [fn.count("id").as("count")])
                .where("fediverse_username", "=", fediverse_username)
                .executeTakeFirstOrThrow();
              return Number(result.count) > 0;
            },
            catch: (error) =>
              new GuestbookValidationError({
                message: `Failed to check if user signed: ${error}`,
              }),
          }).pipe(Effect.retry(retryPolicy));
        }),

        createOAuthSession: Effect.fn("DatabaseService.createOAuthSession")(function* (
          params: OAuthSessionParams,
        ) {
          return yield* Effect.tryPromise({
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
          }).pipe(Effect.retry(retryPolicy));
        }),

        getOAuthSession: Effect.fn("DatabaseService.getOAuthSession")(function* (
          session_token: string,
        ) {
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await db
                .selectFrom("oauth_sessions")
                .selectAll()
                .where("session_token", "=", session_token)
                .where("expires_at", ">", new Date())
                .limit(1)
                .executeTakeFirst();
              return result ?? null;
            },
            catch: (error) =>
              new OAuthSessionError({
                message: `Failed to get OAuth session: ${error}`,
                sessionToken: session_token,
              }),
          }).pipe(Effect.retry(retryPolicy));
        }),

        deleteOAuthSession: Effect.fn("DatabaseService.deleteOAuthSession")(function* (
          session_token: string,
        ) {
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await db
                .deleteFrom("oauth_sessions")
                .where("session_token", "=", session_token)
                .executeTakeFirst();
              return Number(result.numDeletedRows);
            },
            catch: (error) =>
              new OAuthSessionError({
                message: `Failed to delete OAuth session: ${error}`,
                sessionToken: session_token,
              }),
          }).pipe(Effect.retry(retryPolicy));
        }),

        cleanupExpiredSessions: Effect.fn("DatabaseService.cleanupExpiredSessions")(function* () {
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await db
                .deleteFrom("oauth_sessions")
                .where("expires_at", "<", new Date())
                .executeTakeFirst();
              return Number(result.numDeletedRows);
            },
            catch: (error) =>
              new OAuthSessionError({
                message: `Failed to cleanup expired sessions: ${error}`,
              }),
          }).pipe(Effect.retry(retryPolicy));
        }),
      };
    }),
  );
}

import { Context, Effect, Layer, Redacted } from "effect";
import { retryPolicy } from "@tom/utils/retry";
import { AppConfig } from "@tom/utils/services/config";
import {
  DatabaseConnectionError,
  GuestbookValidationError,
  OAuthSessionError,
} from "@tom/types/errors";
import type { Database } from "@tom/types/db";
import type { Kysely } from "kysely";
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

export interface DatabaseServiceContract {
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

type DbFailure = GuestbookValidationError | OAuthSessionError;

// Create Kysely connection from connection string
const createConnection = (
  connectionString: string,
): Effect.Effect<Kysely<Database>, DatabaseConnectionError> =>
  Effect.gen(function* () {
    // Load the Postgres driver stack lazily so it stays out of the adapter's
    // cold-start module graph (only the guestbook integration uses the DB).
    const [{ default: postgres }, { Kysely }, { PostgresJSDialect }] = yield* Effect.tryPromise({
      try: () => Promise.all([import("postgres"), import("kysely"), import("kysely-postgres-js")]),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Failed to load database driver: ${error}`,
        }),
    });

    return yield* Effect.try({
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
  });

/**
 * One Kysely instance (with its postgres.js pool) per connection string,
 * kept for the isolate's lifetime. Built lazily on the first query, so
 * building the service layer never touches the network.
 */
const dbCache = new Map<string, Kysely<Database>>();

const getDb = (
  connectionString: string,
): Effect.Effect<Kysely<Database>, DatabaseConnectionError> =>
  Effect.gen(function* () {
    const cached = dbCache.get(connectionString);
    if (cached) return cached;
    const db = yield* createConnection(connectionString);
    dbCache.set(connectionString, db);
    return db;
  });

/**
 * Close the cached connection for a connection string and drop it from the
 * cache. Used by tests (and any shutdown path) to release the pool.
 */
export const closeDb = (connectionString: string): Effect.Effect<void, DatabaseConnectionError> =>
  Effect.gen(function* () {
    const db = dbCache.get(connectionString);
    if (!db) return;
    dbCache.delete(connectionString);
    yield* Effect.tryPromise({
      try: () => db.destroy(),
      catch: (cause) =>
        new DatabaseConnectionError({
          message: `Failed to close database connection: ${cause}`,
          cause,
        }),
    });
  });

/**
 * Run one statement against the shared connection. Connection setup retries
 * transient failures (exponential backoff); statement failures map to the
 * contract error and fail fast — constraint violations are not retried.
 */
const query =
  (connectionString: string) =>
  <A, E extends DbFailure>(
    label: string,
    build: (db: Kysely<Database>) => Promise<A>,
    toError: (cause: unknown) => E,
  ): Effect.Effect<A, E> =>
    Effect.gen(function* () {
      const db = yield* getDb(connectionString).pipe(
        Effect.retry({
          while: (error) => error._tag === "DatabaseConnectionError",
          schedule: retryPolicy,
        }),
        Effect.mapError(toError),
      );
      return yield* Effect.tryPromise({ try: () => build(db), catch: toError });
    }).pipe(Effect.withSpan(`db.${label}`));

export class DatabaseService extends Context.Service<DatabaseService, DatabaseServiceContract>()(
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

      const run = query(connectionString);

      const guestbookFailure =
        (operation: string) =>
        (cause: unknown): GuestbookValidationError =>
          new GuestbookValidationError({ message: `Failed to ${operation}`, cause });

      const oauthFailure =
        (operation: string, sessionToken?: string) =>
        (cause: unknown): OAuthSessionError =>
          new OAuthSessionError({
            message: `Failed to ${operation}`,
            ...(sessionToken && { sessionToken }),
            cause,
          });

      return {
        createGuestbookEntry: Effect.fn("DatabaseService.createGuestbookEntry")(
          (params: GuestbookEntryParams) =>
            run(
              "createGuestbookEntry",
              (db) =>
                db
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
              guestbookFailure("create guestbook entry"),
            ),
        ),

        getGuestbookEntries: Effect.fn("DatabaseService.getGuestbookEntries")(function* (params: {
          page?: number;
          page_size?: number;
        }) {
          const page = params.page ?? 1;
          const pageSize = params.page_size ?? 100;
          const offset = (page - 1) * pageSize;

          const [results, totalCountResult] = yield* Effect.all([
            run(
              "getGuestbookEntries",
              (db) =>
                db
                  .selectFrom("guestbook_entries")
                  .selectAll()
                  .orderBy("created_at", "desc")
                  .limit(pageSize)
                  .offset(offset)
                  .execute(),
              guestbookFailure("get guestbook entries"),
            ),
            run(
              "getGuestbookCount",
              (db) =>
                db
                  .selectFrom("guestbook_entries")
                  .select(({ fn }) => [fn.count("id").as("count")])
                  .executeTakeFirstOrThrow(),
              guestbookFailure("get guestbook count"),
            ),
          ]);

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
          const result = yield* run(
            "hasUserSigned",
            (db) =>
              db
                .selectFrom("guestbook_entries")
                .select(({ fn }) => [fn.count("id").as("count")])
                .where("fediverse_username", "=", fediverse_username)
                .executeTakeFirstOrThrow(),
            guestbookFailure("check if user signed"),
          );
          return Number(result.count) > 0;
        }),

        createOAuthSession: Effect.fn("DatabaseService.createOAuthSession")(function* (
          params: OAuthSessionParams,
        ) {
          return yield* run(
            "createOAuthSession",
            (db) =>
              db
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
            oauthFailure("create OAuth session", params.session_token),
          );
        }),

        getOAuthSession: Effect.fn("DatabaseService.getOAuthSession")(function* (
          session_token: string,
        ) {
          const session = yield* run(
            "getOAuthSession",
            (db) =>
              db
                .selectFrom("oauth_sessions")
                .selectAll()
                .where("session_token", "=", session_token)
                .where("expires_at", ">", new Date())
                .limit(1)
                .executeTakeFirst(),
            oauthFailure("get OAuth session", session_token),
          );
          return session ?? null;
        }),

        deleteOAuthSession: Effect.fn("DatabaseService.deleteOAuthSession")(function* (
          session_token: string,
        ) {
          const result = yield* run(
            "deleteOAuthSession",
            (db) =>
              db
                .deleteFrom("oauth_sessions")
                .where("session_token", "=", session_token)
                .executeTakeFirst(),
            oauthFailure("delete OAuth session", session_token),
          );
          return Number(result.numDeletedRows);
        }),

        cleanupExpiredSessions: Effect.fn("DatabaseService.cleanupExpiredSessions")(function* () {
          const result = yield* run(
            "cleanupExpiredSessions",
            (db) =>
              db
                .deleteFrom("oauth_sessions")
                .where("expires_at", "<", new Date())
                .executeTakeFirst(),
            oauthFailure("cleanup expired sessions"),
          );
          return Number(result.numDeletedRows);
        }),
      };
    }),
  );
}

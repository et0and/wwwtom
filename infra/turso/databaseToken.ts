import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { TursoHttp } from "./http.ts";
import type { TokenAuthorization } from "./http.ts";

const MS_PER_DAY = 86_400_000;

export type DatabaseTokenProps = {
  /** Name of the database the token is scoped to. */
  readonly database: string;
  /** Lifetime in days. Omit for a token that never expires. The provider
   * replaces the token once this lapses, so a static value still rotates. */
  readonly expiresInDays?: number;
  readonly authorization?: TokenAuthorization;
};

export type DatabaseTokenAttributes = {
  readonly database: string;
  /** The minted SQL-engine JWT. Turso never returns it again, so it only ever
   * reaches the state store from the deploy that minted it. */
  readonly jwt: Redacted.Redacted;
  readonly authorization: TokenAuthorization;
  readonly issuedAt: string;
  /** ISO timestamp the token stops working. Absent for a non-expiring token. */
  readonly expiresAt?: string;
};

export interface DatabaseToken extends Resource<
  "Turso.DatabaseToken",
  DatabaseTokenProps,
  DatabaseTokenAttributes
> {}

export const DatabaseToken = Resource<DatabaseToken>("Turso.DatabaseToken");

const DEFAULT_AUTHORIZATION: TokenAuthorization = "full-access";

export const DatabaseTokenProvider = () =>
  Provider.effect(
    DatabaseToken as ResourceClassLike<DatabaseToken>,
    Effect.gen(function* () {
      const http = yield* TursoHttp;

      return {
        list: () => Effect.succeed([] as DatabaseTokenAttributes[]),

        // A JWT cannot be patched, so any change — including a lapsed lifetime —
        // means minting a replacement. The JWT itself is output, never props, so
        // a redeploy with unchanged, unexpired props mints nothing.
        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const old = olds ?? {};
            if (
              (old.database !== undefined && old.database !== news.database) ||
              (old.expiresInDays !== undefined && old.expiresInDays !== news.expiresInDays) ||
              (old.authorization !== undefined &&
                old.authorization !== (news.authorization ?? DEFAULT_AUTHORIZATION))
            ) {
              return { action: "replace" } as const;
            }
            const expiresAt = output?.expiresAt;
            if (expiresAt !== undefined && Date.parse(expiresAt) <= Date.now()) {
              return { action: "replace" } as const;
            }
            return undefined;
          }),

        // Turso has no read-back for a minted token, so the stored attributes
        // are returned unchanged. Without this every deploy would re-mint and
        // invalidate the token the workers are using.
        read: ({ output }) => Effect.succeed(output),

        reconcile: Effect.fn(function* ({ news }) {
          const authorization = news.authorization ?? DEFAULT_AUTHORIZATION;
          const now = Date.now();
          const { jwt } = yield* http.createDatabaseToken(news.database, {
            authorization,
            // Turso's own default is `never`; `Nd` is the shortest form that
            // round-trips the whole-day lifetime the props express.
            ...(news.expiresInDays !== undefined
              ? { expiration: `${news.expiresInDays}d` }
              : undefined),
          });
          return {
            database: news.database,
            jwt: Redacted.make(jwt),
            authorization,
            issuedAt: new Date(now).toISOString(),
            ...(news.expiresInDays !== undefined
              ? { expiresAt: new Date(now + news.expiresInDays * MS_PER_DAY).toISOString() }
              : undefined),
          };
        }),

        delete: Effect.fn(function* () {
          // Turso can only invalidate every token for a database at once
          // (POST /databases/{name}/auth/tokens/invalidate), which would break
          // consumers this stack does not own. Tearing down a stack therefore
          // leaves its token valid until it expires.
        }),

        // Same reason: there is no per-token delete for nuke to wait on.
        nuke: { skip: true },
      } satisfies Provider.ProviderServiceInput<DatabaseToken>;
    }),
  );

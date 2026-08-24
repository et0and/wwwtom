import * as Effect from "effect/Effect";
import * as Provider from "alchemy/Provider";
import { isResolved } from "alchemy/Diff";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { GtmHttp } from "./http.ts";
import type { Account as AccountSchema } from "./schemas.ts";

export type AccountProps = {
  readonly path: string;
};

export type AccountAttributes = {
  readonly accountId: string;
  readonly path: string;
  readonly name: string;
  readonly tagManagerUrl: string;
  readonly fingerprint: string;
  readonly shareData?: boolean;
  readonly features?: AccountSchema["features"];
};

export interface Account extends Resource<"Gtm.Account", AccountProps, AccountAttributes> {}

export const Account = Resource<Account>("Gtm.Account");

export const AccountProvider = () =>
  Provider.effect(
    Account as ResourceClassLike<Account>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;

      const toAttrs = (acc: AccountSchema): AccountAttributes =>
        ({
          ...acc,
          fingerprint: acc.fingerprint ?? "",
        }) as AccountAttributes;

      return {
        list: () => Effect.succeed([] as AccountAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const oldPath = output?.path ?? olds?.path;
            if (oldPath !== undefined && news.path !== oldPath) {
              return { action: "replace" } as const;
            }
            return undefined;
          }),

        read: Effect.fn(function* ({ olds, output }) {
          const o: Partial<AccountProps> = olds ?? {};
          const path = output?.path ?? o.path;
          if (!path) return undefined;
          const existing = yield* http
            .getAccount(path)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
          if (!existing) return undefined;
          return toAttrs(existing);
        }),

        reconcile: Effect.fn(function* ({ news }) {
          const acc = yield* http.getAccount(news.path);
          return toAttrs(acc);
        }),

        delete: Effect.fn(function* () {
          // Account is ref-only; nothing to delete.
        }),
      } satisfies Provider.ProviderServiceInput<Account>;
    }),
  );

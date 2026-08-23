import * as Effect from "effect/Effect";
import * as Provider from "alchemy/Provider";
import { isResolved } from "alchemy/Diff";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { GtmHttp } from "./http.ts";
import type { Account as AccountSchema, AccountFeatures } from "./schemas.ts";

export type AccountProps = {
  path: string;
};

export type AccountAttributes = {
  accountId: string;
  path: string;
  name: string;
  tagManagerUrl: string;
  fingerprint: string;
  shareData?: boolean;
  features?: AccountFeatures;
};

export interface Account extends Resource<"Gtm.Account", AccountProps, AccountAttributes> {}

export const Account = Resource<Account>("Gtm.Account");

export const AccountProvider = () =>
  Provider.effect(
    Account as ResourceClassLike<Account>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;

      const toAttrs = (acc: AccountSchema): AccountAttributes => {
        const attrs: AccountAttributes = {
          accountId: acc.accountId,
          path: acc.path,
          name: acc.name,
          tagManagerUrl: acc.tagManagerUrl,
          fingerprint: acc.fingerprint ?? "",
        };
        if (acc.shareData !== undefined) attrs.shareData = acc.shareData;
        if (acc.features !== undefined) attrs.features = acc.features;
        return attrs;
      };

      return {
        list: () => Effect.succeed([] as AccountAttributes[]),

        // Path is the only prop and it is immutable upstream: changing it
        // means pointing at a different Google account, so replace.
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

import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Account, AccountProvider } from "../account.ts";
import { makeFakeState } from "../fake.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(AccountProvider(), makeTestLayer(state));

describe("Account provider", () => {
  it("reads an adopted account by path", async () => {
    const state = makeFakeState();
    state.accounts.set("accounts/123", {
      path: "accounts/123",
      accountId: "123",
      name: "Test Account",
      tagManagerUrl: "https://tagmanager.google.com/#/admin/accounts/123",
    });

    const attrs = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Account);
        return yield* provider.reconcile({
          id: "acct",
          fqn: "Gtm.Account/acct",
          instanceId: "test-instance",
          news: { path: "accounts/123" },
          olds: undefined,
          output: undefined,
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(attrs).toMatchObject({ accountId: "123", path: "accounts/123", name: "Test Account" });
  });
});

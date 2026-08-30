import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

/**
 * The Cloudflare Flagship app holding all feature flags. Any app worker that
 * evaluates flags (api first, adapter/web later) binds it as `FLAGS` in its
 * env; evaluation goes through `Flags.Binding(env.FLAGS)` from
 * `@tom/flags/service` — see packages/@tom/flags for the flag definitions.
 *
 * Every stage gets its own app (Alchemy derives the app name from the stack,
 * stage, and logical id), so dev/staging/production flags are independent
 * and a per-stage teardown never touches another stage's flags. Flags
 * themselves are `Cloudflare.Flagship.Flag` resources added here as real
 * features land; flag *values* are still editable in the dashboard and take
 * effect without redeploying.
 *
 * @example Defining a flag (with targeting + rollout) under this app
 * ```ts
 * const app = yield* tomFlags;
 * yield* Cloudflare.Flagship.Flag("NewCheckout", {
 *   appId: app.appId,
 *   key: "new-checkout",
 *   defaultVariation: "off",
 *   variations: { off: false, on: true },
 *   rules: [
 *     {
 *       priority: 1,
 *       conditions: [{ attribute: "userId", operator: "equals", value: "user-42" }],
 *       serveVariation: "on",
 *     },
 *     {
 *       priority: 2,
 *       conditions: [{ attribute: "plan", operator: "equals", value: "enterprise" }],
 *       serveVariation: "on",
 *       rollout: { percentage: 10 },
 *     },
 *   ],
 * });
 * ```
 */
export const tomFlags = Effect.gen(function* () {
  return yield* Cloudflare.Flagship.App("tom-flags", {});
});

/**
 * Client-side flag reading.
 *
 * The browser never touches a binding or a network. The server evaluates the
 * flags a page uses (used-only), delivers a {@link FlagSnapshot}, and the
 * client reads values synchronously from it. A flag missing from the
 * snapshot falls back to its registered default with reason
 * "NOT_DELIVERED" — a stale client or a typo never breaks the page.
 */
import { flags, type FlagName } from "@tom/flags/registry";
import type { FlagEvaluation } from "@tom/flags/binding";

/**
 * A partial snapshot of flag evaluations, keyed by flag name. Only the flags
 * the page requested are present.
 */
export type FlagSnapshot = { readonly [Name in FlagName]?: FlagEvaluation };

/** Read one flag from a snapshot, falling back to its registered default. */
export const get = (snapshot: FlagSnapshot, name: FlagName): FlagEvaluation =>
  snapshot[name] ?? { value: flags[name].defaultOn, reason: "NOT_DELIVERED" };

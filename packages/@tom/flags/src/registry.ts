/**
 * The flag registry — the single source of truth for flag keys.
 *
 * Every flag on the site is declared here, once. The map keys are the flag
 * keys and the {@link FlagName} union is derived (`keyof`) rather than
 * maintained by hand, so a flag's key appears in exactly one place. Server
 * evaluation, the client reader, the snapshot shape, and static overrides
 * all key off {@link FlagName} — a typo anywhere is a compile error.
 */
import { flag } from "./flag";

/**
 * The site's flags. Add a new flag here and it becomes typed everywhere
 * (server evaluate, client read, snapshot keys, static overrides) for free.
 */
export const flags = {
  "dark-mode": flag({ defaultOn: false }),
  "checkout-flow": flag({ defaultOn: true }),
};

/** The fully typed union of every declared flag key. */
export type FlagName = keyof typeof flags;

/** True when `name` is a declared flag key. */
export const isFlagName = (name: string): name is FlagName => name in flags;

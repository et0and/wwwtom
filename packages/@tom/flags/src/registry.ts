/**
 * The flag registry — the single source of truth for flag keys.
 *
 * Every flag on the site is declared here, once. The map keys are the flag
 * keys; the registry stamps them onto the flag definitions, so the key
 * string never appears in two places and the {@link FlagName} union is
 * derived (`keyof`) rather than maintained by hand. Server evaluation, the
 * client reader, the snapshot shape, and static overrides all key off
 * {@link FlagName} — a typo anywhere is a compile error.
 */
import { flag, type FlagSpec } from "./flag.js";

/** A flag stamped with its (literal) key and on/off default. */
export type Flag<Name extends string> = {
  readonly key: Name;
  readonly defaultValue: boolean;
};

/**
 * Stamps each declared flag with its key and derives the flag types. The
 * returned object maps the same keys, so `keyof` gives the flag-name union.
 */
export const registry = <const T extends Record<string, FlagSpec>>(
  defs: T,
): { readonly [K in keyof T & string]: Flag<K> } =>
  Object.fromEntries(
    Object.entries(defs).map(([name, spec]) => [name, { key: name, defaultValue: spec.defaultOn }]),
  ) as { readonly [K in keyof T & string]: Flag<K> };

/** True when `name` is a declared flag key. */
export const isFlagName = (name: string): name is FlagName => name in flags;

/**
 * The site's flags. Add a new flag here and it becomes typed everywhere
 * (server evaluate, client read, snapshot keys, static overrides) for free.
 */
export const flags = registry({
  "dark-mode": flag({ defaultOn: false }),
  "checkout-flow": flag({ defaultOn: true }),
});

/** The fully typed union of every declared flag key. */
export type FlagName = keyof typeof flags;

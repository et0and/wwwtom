/**
 * Flag declaration primitives.
 *
 * A flag is declared once, inside the registry, with a single on/off
 * default. The registry stamps the key (the map key) onto the flag, so a
 * flag's key string never has to be written twice and the {@link FlagName}
 * union is derived from the registry itself.
 *
 * @example
 * ```ts
 * export const flags = registry({
 *   "dark-mode": flag({ defaultOn: false }),
 *   "checkout-flow": flag({ defaultOn: true }),
 * });
 * ```
 */
export type FlagSpec = {
  readonly defaultOn: boolean;
};

export const flag = (spec: FlagSpec): FlagSpec => spec;

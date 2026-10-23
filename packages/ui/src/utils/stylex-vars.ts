/**
 * The CSS custom property behind a `defineVars` key.
 *
 * A `defineVars` key resolves to the CSS *value* `var(--x123)`, so it cannot be
 * used directly as an object key when setting an inline custom property. This
 * unwraps it to the underlying property name, which callers then use with
 * `element.style.setProperty` or a `style` attribute.
 */
export function customPropertyName(stylexVar: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(stylexVar);
  if (match?.[1] === undefined) {
    throw new Error(`Expected a defineVars value like var(--x123), received ${stylexVar}`);
  }
  return match[1];
}

/** Custom properties for a set of `defineVars` keys, ready for a style attribute. */
export function customProperties(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [customPropertyName(key), value]),
  );
}

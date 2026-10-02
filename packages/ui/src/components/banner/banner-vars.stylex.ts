import * as stylex from "@stylexjs/stylex";

/**
 * The banner accent colour. `Banner.Action` reads it from context at runtime,
 * so it cannot live in a static rule: the component sets this inline and the
 * styles reference it. StyleX requires defineVars to be a named export in a
 * `.stylex.ts` file.
 */
export const bannerAccentVars = stylex.defineVars({ accent: null });

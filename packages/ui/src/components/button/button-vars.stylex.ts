import * as stylex from "@stylexjs/stylex";

/**
 * Emphasis variants (`primary`, `destructive`) paint a gradient overlay and
 * read their colours from these four vars.
 *
 * StyleX cannot compile a runtime colour mix into a static rule, so the Button
 * sets these inline per variant and the static rules reference them here.
 * StyleX requires defineVars to be a named export in a `.stylex.ts` file.
 */
export const buttonEmphasisVars = stylex.defineVars({
  bg: null,
  ring: null,
  gradientStart: null,
  gradientEnd: null,
});

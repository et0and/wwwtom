import * as stylex from "@stylexjs/stylex";

/** Matches `colors.stylex.ts`. */
const DARK = "@media (prefers-color-scheme: dark)";

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

/**
 * `glass` variant tokens. The variant is a translucent surface lit from the top
 * left, so it is described by whole gradient strings rather than single
 * colours: `surface` is the frosted fill, `sheen` the diagonal light that sits
 * over it, `hood` the bright top edge, `ring` the hairline, and `drop` the
 * shadow beneath.
 *
 * Light mode frosts white over the page; dark mode lifts a white veil off it.
 * The hover state only swaps the fill, so the browser has nothing to
 * interpolate and the change lands on the same frame as the pointer.
 */
export const buttonGlassVars = stylex.defineVars({
  surface: {
    default: "linear-gradient(180deg, oklch(100% 0 0 / 0.9) 0%, oklch(100% 0 0 / 0.6) 100%)",
    [DARK]: "linear-gradient(180deg, oklch(100% 0 0 / 0.14) 0%, oklch(100% 0 0 / 0.05) 100%)",
  },
  surfaceHover: {
    default: "linear-gradient(180deg, oklch(100% 0 0 / 1) 0%, oklch(100% 0 0 / 0.8) 100%)",
    [DARK]: "linear-gradient(180deg, oklch(100% 0 0 / 0.2) 0%, oklch(100% 0 0 / 0.08) 100%)",
  },
  sheen: {
    default: "linear-gradient(160deg, oklch(100% 0 0 / 0.72) 0%, transparent 46%)",
    [DARK]: "linear-gradient(160deg, oklch(100% 0 0 / 0.26) 0%, transparent 46%)",
  },
  hood: {
    default: "oklch(100% 0 0 / 0.85)",
    [DARK]: "oklch(100% 0 0 / 0.16)",
  },
  ring: {
    default: "oklch(0% 0 0 / 0.08)",
    [DARK]: "oklch(100% 0 0 / 0.14)",
  },
  drop: {
    default: "oklch(0% 0 0 / 0.06)",
    [DARK]: "oklch(0% 0 0 / 0.45)",
  },
});

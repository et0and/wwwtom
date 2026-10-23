import * as stylex from "@stylexjs/stylex";

/**
 * The copy button revealed itself through a Tailwind named group. StyleX has no
 * group syntax, so the container publishes its reveal state as this variable and
 * the button reads it. `defineVars` must live in a `.stylex.ts` file.
 */
export const copyReveal = stylex.defineVars({ opacity: "0" });

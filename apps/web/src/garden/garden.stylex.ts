import * as stylex from "@stylexjs/stylex";

/**
 * Garden tokens. `accent` is the site's link hover pink, matching
 * apps/web/src/app.css, so tiles and the meter share one themed value.
 */
export const gardenVars = stylex.defineVars({
  accent: {
    default: "#cc0081",
    "@media (prefers-color-scheme: dark)": "#ff4da6",
  },
});

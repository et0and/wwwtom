import * as stylex from "@stylexjs/stylex";

/**
 * Type scale. These replace the `--text-*` size and line-height pairs from
 * theme-tomui.css, which overrode Tailwind's defaults (14px body, 13px small).
 * `defineConsts` is correct here: sizes are static, not themeable.
 *
 * `fontSizeHeadingLarge` is the one size with no token of its own in the old
 * scale, because only the heading variant used it.
 */
export const fontSizeXs = stylex.defineConsts({
  fontSize: "12px",
  lineHeight: "1.333",
});

export const fontSizeSm = stylex.defineConsts({
  fontSize: "13px",
  lineHeight: "1.176",
});

export const fontSizeBase = stylex.defineConsts({
  fontSize: "14px",
  lineHeight: "1.5",
});

export const fontSizeLg = stylex.defineConsts({
  fontSize: "16px",
  lineHeight: "1.5",
});

export const fontSizeXl = stylex.defineConsts({
  fontSize: "20px",
  lineHeight: "1.5",
});

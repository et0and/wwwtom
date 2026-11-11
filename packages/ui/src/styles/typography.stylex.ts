import * as stylex from "@stylexjs/stylex";

/**
 * Type scale. `defineConsts` is correct here: sizes are static, not
 * themeable.
 *
 * `fontSizeHeadingLarge` is the one size with no token of its own in the old
 * scale, because only the heading variant used it.
 */
/** Micro text: badge labels, captions, and inline metadata. */
export const fontSize2xs = stylex.defineConsts({
  fontSize: "11px",
  lineHeight: "1",
});

export const fontSizeXs = stylex.defineConsts({
  fontSize: "12px",
  lineHeight: "1.333",
});

/** Compact control text. OpenCode uses 13px across buttons and inputs. */
export const fontSizeSm = stylex.defineConsts({
  fontSize: "13px",
  lineHeight: "1.538",
});

/** Control weight. Inter's 530 sits between regular and medium. */
export const fontWeightControl = stylex.defineConsts({
  fontWeight: 530,
});

/** Dialog and empty-state titles. */
export const fontSizeMd = stylex.defineConsts({
  fontSize: "15px",
  lineHeight: "20px",
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

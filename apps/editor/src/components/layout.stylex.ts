import * as stylex from "@stylexjs/stylex";

/**
 * One-off layout styles for editor call sites. TomUI components take a `style`
 * prop of StyleX styles, so a caller needing a single tweak passes one of these
 * instead of a Tailwind class.
 */
export const layoutStyles = stylex.create({
  justifySelfStart: { justifySelf: "start" },
  marginLeftAuto: { marginInlineStart: "auto" },
  fullWidth: { width: "100%" },
  flexWrap: { flexWrap: "wrap" },
  itemsCenter: { alignItems: "center" },
  justifyBetween: { justifyContent: "space-between" },
});

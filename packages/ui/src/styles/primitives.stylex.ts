import * as stylex from "@stylexjs/stylex";

/**
 * Layout primitives shared across TomUI components.
 *
 * StyleX cannot merge a runtime class string, so the recurring utility
 * combinations that Tailwind components used to repeat inline live here as
 * named styles instead. Components compose these rather than restating values.
 */
export const layout = stylex.create({
  flexRow: { display: "flex", flexDirection: "row" },
  flexRowCentered: { display: "flex", flexDirection: "row", alignItems: "center" },
  flexCol: { display: "flex", flexDirection: "column" },
  flexColCentered: { display: "flex", flexDirection: "column", alignItems: "center" },
  inlineFlexRowCentered: { display: "inline-flex", flexDirection: "row", alignItems: "center" },
  flexWrapRow: { display: "flex", flexDirection: "row", flexWrap: "wrap" },

  itemsCenter: { alignItems: "center" },
  itemsStart: { alignItems: "flex-start" },
  itemsBaseline: { alignItems: "baseline" },
  justifyCenter: { justifyContent: "center" },
  justifyBetween: { justifyContent: "space-between" },
  justifyStart: { justifyContent: "flex-start" },
  justifyEnd: { justifyContent: "flex-end" },

  gap1: { gap: "0.25rem" },
  gap1_5: { gap: "0.375rem" },
  gap2: { gap: "0.5rem" },
  gap3: { gap: "0.75rem" },
  gap4: { gap: "1rem" },
  gap6: { gap: "1.5rem" },
  gap8: { gap: "2rem" },

  fullWidth: { width: "100%" },
  autoWidth: { width: "auto" },
  minWidth0: { minWidth: 0 },
  maxWidthFull: { maxWidth: "100%" },
  fitContent: { width: "fit-content" },

  relative: { position: "relative" },
  absolute: { position: "absolute" },
  absoluteInset0: { position: "absolute", inset: 0 },
  stickyTop: { position: "sticky", top: 0 },
  stickyBottom: { position: "sticky", bottom: 0 },

  hidden: { display: "none" },
  block: { display: "block" },
  inlineBlock: { display: "inline-block" },
  contents: { display: "contents" },
  /** Grid/flex self placement. */
  justifySelfStart: { justifySelf: "start" },
  marginLeftAuto: { marginInlineStart: "auto" },
  flexWrap: { flexWrap: "wrap" },
  fullHeight: { height: "100%" },
});

/** Text alignment. */
export const textAlign = stylex.create({
  center: { textAlign: "center" },
  left: { textAlign: "left" },
  right: { textAlign: "right" },
  balance: { textWrap: "balance" },
});

/** Single-direction spacing used by form controls and buttons. */
export const spacing = stylex.create({
  p0: { padding: 0 },
  px1: { paddingInline: "0.25rem" },
  px1_5: { paddingInline: "0.375rem" },
  px2: { paddingInline: "0.5rem" },
  px3: { paddingInline: "0.75rem" },
  px4: { paddingInline: "1rem" },
  px5: { paddingInline: "1.25rem" },
  px6: { paddingInline: "1.5rem" },
  py0: { paddingBlock: 0 },
  py0_5: { paddingBlock: "0.125rem" },
  py1: { paddingBlock: "0.25rem" },
  py1_5: { paddingBlock: "0.375rem" },
  py2: { paddingBlock: "0.5rem" },
  py2_5: { paddingBlock: "0.625rem" },
  py3: { paddingBlock: "0.75rem" },
  py4: { paddingBlock: "1rem" },
  py6: { paddingBlock: "1.5rem" },
});

/** Square sizing for icon-sized controls. */
export const sizing = stylex.create({
  size3_5: { width: "0.875rem", height: "0.875rem" },
  size4: { width: "1rem", height: "1rem" },
  size5: { width: "1.25rem", height: "1.25rem" },
  size6_5: { width: "1.625rem", height: "1.625rem" },
  size9: { width: "2.25rem", height: "2.25rem" },
  size10: { width: "2.5rem", height: "2.5rem" },
  h5: { height: "1.25rem" },
  h6_5: { height: "1.625rem" },
  h9: { height: "2.25rem" },
  h10: { height: "2.5rem" },
});

/** Border radius steps. Concentric shapes use outer = inner + padding. */
export const radius = stylex.create({
  none: { borderRadius: 0 },
  sm: { borderRadius: "0.25rem" },
  md: { borderRadius: "0.375rem" },
  lg: { borderRadius: "0.5rem" },
  xl: { borderRadius: "0.75rem" },
  full: { borderRadius: "9999px" },
  /** Matches the parent's radius, for overlays and focus rings. */
  inherit: { borderRadius: "inherit" },
});

/** Font weights. Headings are semibold; inline emphasis is medium. */
export const weight = stylex.create({
  normal: { fontWeight: 400 },
  medium: { fontWeight: 500 },
  semibold: { fontWeight: 600 },
});

/** Overflow, truncation, and scroll helpers. */
export const overflow = stylex.create({
  hidden: { overflow: "hidden" },
  auto: { overflow: "auto" },
  truncate: { overflow: "hidden", textOverflow: "ellipsis" },
  noWrap: { whiteSpace: "nowrap" },
  /** Prevents an icon from wrapping onto its own line beside text. */
  noShrink: { flexShrink: 0 },
  shrink: { flexShrink: 1 },
});

/** Cursor intents. */
export const cursor = stylex.create({
  pointer: { cursor: "pointer" },
  notAllowed: { cursor: "not-allowed" },
});

/** User-select intents. */
export const select = stylex.create({
  none: { userSelect: "none" },
  text: { userSelect: "text" },
});

/** Monospace stack, matching the old Tailwind `font-mono`. */
export const monoFont = stylex.defineConsts({
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

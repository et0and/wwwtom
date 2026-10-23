import * as stylex from "@stylexjs/stylex";
import { colors } from "./colors.stylex";
import { textColors } from "./tokens.stylex";

/**
 * Layout primitives shared across TomUI components.
 *
 * Two kinds of thing live here, and the distinction matters:
 *
 * - **Values** (`radius`, `spacing`, `cursor`, `select`) are `defineConsts`, so
 *   a component can embed them in its own rule: `borderRadius: radius.lg`.
 * - **Styles** (`layout`, `sizing`, `overflow`, `textAlign`, `menuItem`) are
 *   `stylex.create`, so a component can compose whole style objects:
 *   `stylex.attrs(styles.row, layout.itemsCenter)`.
 *
 * Reading a property off a `stylex.create` namespace — the pattern
 * `radius.lg` — compiles to a `var()` that nothing ever defines, so
 * the declaration is dropped and the property silently falls back to its initial
 * value. Consts have no such problem: they compile to the literal.
 */
export const radius = stylex.defineConsts({
  none: "0",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "9999px",
  inherit: "inherit",
});

/** Single-direction spacing. Gaps draw from the same scale as padding. */
export const spacing = stylex.defineConsts({
  p0: "0",
  px1: "0.25rem",
  px1_5: "0.375rem",
  px2: "0.5rem",
  px3: "0.75rem",
  px4: "1rem",
  px5: "1.25rem",
  px6: "1.5rem",
  py0: "0",
  py0_5: "0.125rem",
  py1: "0.25rem",
  py1_5: "0.375rem",
  py2: "0.5rem",
  py2_5: "0.625rem",
  py3: "0.75rem",
  py4: "1rem",
  py6: "1.5rem",
});

/** Cursor intents. */
export const cursor = stylex.defineConsts({
  pointer: "pointer",
  notAllowed: "not-allowed",
});

/** User-select intents. */
export const select = stylex.defineConsts({
  none: "none",
  text: "text",
});

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

  gap1: { gap: spacing.px1 },
  gap1_5: { gap: spacing.px1_5 },
  gap2: { gap: spacing.px2 },
  gap4: { gap: spacing.px4 },

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

const brandColor = colors["--color-tomui-brand"];
const tintColor = colors["--color-tomui-tint"];
const hairlineColor = colors["--color-tomui-hairline"];
const dangerText = textColors["--text-color-tomui-danger"];

/** Monospace stack, matching the old Tailwind `font-mono`. */
export const monoFont = stylex.defineConsts({
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

/**
 * Menu item chrome, shared by DropdownMenu, Combobox, Autocomplete, and
 * CommandPalette. All four render the same selectable-row pattern, and each
 * drives its highlighted state from a data attribute.
 */
export const menuItem = stylex.create({
  base: {
    position: "relative",
    display: "flex",
    width: "100%",
    alignItems: "center",
    cursor: "default",
    userSelect: "none",
    fontSize: "0.875rem",
    outlineWidth: 0,
    ":focus-visible": { boxShadow: "0 0 0 2px " + brandColor },
    ":is([data-highlighted])": { backgroundColor: tintColor },
    ":is([data-disabled])": { pointerEvents: "none", opacity: 0.5 },
  },
  /** Indented to clear the check column. */
  checkable: { paddingLeft: "2rem" },
  plain: { paddingInline: "0.5rem" },
  vertical: { paddingBlock: "0.375rem" },
  rounded: { borderRadius: "0.375rem" },
  danger: {
    color: dangerText,
    ":is([data-highlighted])": {
      backgroundColor: "color-mix(in srgb, " + dangerText + " 5%, transparent)",
      color: dangerText,
    },
  },
  /** Check mark column, pinned to the leading edge. */
  checkColumn: {
    position: "absolute",
    left: "0.5rem",
    display: "inline-flex",
    width: "0.875rem",
    height: "0.875rem",
    alignItems: "center",
    justifyContent: "center",
    color: "inherit",
  },
  trailing: { marginInlineStart: "auto", display: "inline-flex" },
  label: {
    paddingInline: "0.5rem",
    paddingBlock: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  labelInset: { paddingInlineStart: "2rem" },
  separator: {
    marginInline: "-0.25rem",
    marginBlock: "0.25rem",
    height: "1px",
    backgroundColor: hairlineColor,
    borderWidth: 0,
  },
  shortcut: {
    marginInlineStart: "auto",
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    opacity: 0.6,
  },
});

import * as stylex from "@stylexjs/stylex";
import { textColors } from "../../styles/tokens.stylex";
import {
  fontSizeBase,
  fontSizeLg,
  fontSizeSm,
  fontSizeXl,
  fontSizeXs,
} from "../../styles/typography.stylex";

/**
 * Text styles, flat rather than nested under `variant`/`size` keys. StyleX
 * types a namespace as one opaque object, so a nested namespace cannot be
 * indexed dynamically and passed to `stylex.attrs`.
 */
export const textStyles = stylex.create({
  // Variants
  heading: {
    fontSize: fontSizeLg.fontSize,
    lineHeight: "inherit",
    fontWeight: 600,
  },
  body: { color: textColors["--text-color-tomui-default"] },
  secondary: { color: textColors["--text-color-tomui-subtle"] },
  success: { color: textColors["--text-color-tomui-link"] },
  error: { color: textColors["--text-color-tomui-danger"] },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  "mono-secondary": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: textColors["--text-color-tomui-subtle"],
  },

  // Sizes. `lineHeight: "inherit"` replaces the old `text-*/[inherit]`
  // Tailwind modifiers.
  sizeXs: { fontSize: fontSizeXs.fontSize, lineHeight: "inherit" },
  sizeSm: { fontSize: fontSizeSm.fontSize, lineHeight: "inherit" },
  sizeBase: { fontSize: fontSizeBase.fontSize, lineHeight: "inherit" },
  sizeLg: { fontSize: fontSizeLg.fontSize, lineHeight: "inherit" },
  /** Heading-only step up from `lg`. Never a body size. */
  sizeXl: { fontSize: fontSizeXl.fontSize, lineHeight: "inherit" },

  // States
  bold: { fontWeight: 500 },
  truncate: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  /** No-op, so a heading at a non-lg size adds nothing. */
  none: {},
});

/**
 * Per-character blur-in, used by `<Text blurIn>`. Each character fades in as
 * the blur clears, staggered by its index so the line resolves left to right.
 *
 * Motion is opt-in: the animation only applies under
 * `prefers-reduced-motion: no-preference`, so a reader who asks for less motion
 * gets the text already visible.
 */
const blurInChar = stylex.keyframes({
  from: { filter: "blur(0.3em)", opacity: 0 },
  to: { filter: "blur(0)", opacity: 1 },
});

/** Whole-block variant, for a paragraph or a run of text too long to split. */
const blurInBlock = stylex.keyframes({
  from: { filter: "blur(0.2em)", opacity: 0, transform: "translateY(0.4em)" },
  to: { filter: "blur(0)", opacity: 1, transform: "translateY(0)" },
});

export const blurInStyles = stylex.create({
  char: {
    display: "inline-block",
    "@media (prefers-reduced-motion: no-preference)": {
      animationName: blurInChar,
      animationDuration: "0.5s",
      animationTimingFunction: "var(--ease-out, ease-out)",
      animationFillMode: "both",
    },
  },
  /** A word never breaks across lines; the space between words may wrap. */
  word: { display: "inline-block", whiteSpace: "nowrap" },
  /**
   * Animates the element itself, so a paragraph with inline markup (links,
   * emphasis) fades in as one block. Splitting it per character would not
   * survive the mixed children.
   */
  block: {
    "@media (prefers-reduced-motion: no-preference)": {
      animationName: blurInBlock,
      animationDuration: "0.5s",
      animationTimingFunction: "var(--ease-out, ease-out)",
      animationFillMode: "both",
    },
  },
  /** Visually hidden copy that carries the readable text for assistive tech. */
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "clip",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});

export const TOMUI_TEXT_DEFAULT_VARIANTS = {
  variant: "body",
  size: "base",
} as const;

export type TomuiTextVariant =
  | "heading"
  | "body"
  | "secondary"
  | "success"
  | "error"
  | "mono"
  | "mono-secondary";
export type TomuiTextSize = "xs" | "sm" | "base" | "lg";

/** Valid HTML elements for the Text component's `as` prop. */
export type TextElement =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "label"
  | "dt"
  | "dd"
  | "li"
  | "figcaption"
  | "legend"
  | "pre"
  | "code"
  | "em"
  | "strong"
  | "small"
  | "abbr"
  | "time";

/**
 * The element each variant renders as when `as` is not given.
 *
 * Heading variants deliberately render as `span` rather than picking an `h1`-
 * `h3` for themselves: visual presentation is not the document outline. Pass
 * `as` to opt into semantic HTML.
 */
export const DEFAULT_ELEMENT_BY_VARIANT = {
  heading: "span",
  body: "p",
  secondary: "p",
  success: "p",
  error: "p",
  mono: "span",
  "mono-secondary": "span",
} as const satisfies Record<TomuiTextVariant, TextElement>;

/** Variants that `bold` applies to. Headings and monospace ignore it. */
export const BOLDABLE_VARIANTS: ReadonlySet<TomuiTextVariant> = new Set([
  "body",
  "secondary",
  "success",
  "error",
]);

const MONO_VARIANTS: ReadonlySet<TomuiTextVariant> = new Set(["mono", "mono-secondary"]);

/**
 * Resolve the size style for a variant/size pair.
 *
 * Headings step up to `xl` only at `lg` and otherwise keep the size baked into
 * the heading variant itself, so they return nothing. Monospace sits one step
 * below body so the glyphs optically match.
 */
export function resolveTextSizeStyle(
  variant: TomuiTextVariant,
  size: TomuiTextSize,
): stylex.StyleXStyles {
  if (variant === "heading") {
    return size === "lg" ? textStyles.sizeXl : textStyles.none;
  }

  if (MONO_VARIANTS.has(variant)) {
    return size === "lg" ? textStyles.sizeBase : textStyles.sizeSm;
  }

  if (size === "xs") return textStyles.sizeXs;
  if (size === "sm") return textStyles.sizeSm;
  if (size === "lg") return textStyles.sizeLg;
  return textStyles.sizeBase;
}

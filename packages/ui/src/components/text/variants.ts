import { resolveVariant } from "../../utils/resolve-variant";

/** Text variant and size definitions mapping names to their Tailwind classes. */
export const TOMUI_TEXT_VARIANTS = {
  variant: {
    heading: {
      classes: "text-lg font-semibold",
      description: "Heading text (16px by default, 20px at large size)",
    },
    body: {
      classes: "text-tomui-default",
      description: "Default body text",
    },
    secondary: {
      classes: "text-tomui-subtle",
      description: "Muted text for secondary information",
    },
    success: {
      classes: "text-tomui-link",
      description: "Success state text in link color",
    },
    error: {
      classes: "text-tomui-danger",
      description: "Error state text",
    },
    mono: {
      classes: "font-mono",
      description: "Monospace text for code",
    },
    "mono-secondary": {
      classes: "font-mono text-tomui-subtle",
      description: "Muted monospace text",
    },
  },
  size: {
    xs: {
      classes: "text-xs/[inherit]",
      description: "Extra small text",
    },
    sm: {
      classes: "text-sm/[inherit]",
      description: "Small text",
    },
    base: {
      classes: "text-base/[inherit]",
      description: "Default text size",
    },
    lg: {
      classes: "text-lg/[inherit]",
      description: "Large text",
    },
  },
} as const;

export const TOMUI_TEXT_DEFAULT_VARIANTS = {
  variant: "body",
  size: "base",
} as const;

export type TomuiTextVariant = keyof typeof TOMUI_TEXT_VARIANTS.variant;
export type TomuiTextSize = keyof typeof TOMUI_TEXT_VARIANTS.size;

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

const sizeClass = (size: TomuiTextSize): string => TOMUI_TEXT_VARIANTS.size[size].classes;

export function resolveTextSizeClasses(variant: TomuiTextVariant, size: TomuiTextSize): string {
  if (variant === "heading") {
    return size === "lg" ? "text-xl" : "";
  }

  if (MONO_VARIANTS.has(variant)) {
    // Monospace fonts need to be 1pt smaller than body text to optically match.
    return sizeClass(size === "lg" ? "base" : "sm");
  }

  return resolveVariant(TOMUI_TEXT_VARIANTS.size, size, TOMUI_TEXT_DEFAULT_VARIANTS.size).classes;
}

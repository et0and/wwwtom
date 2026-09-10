import { merge, omit } from "solid-js";
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

/** Text variant and size definitions mapping names to their Tailwind classes. */
export const TOMUI_TEXT_VARIANTS = {
  variant: {
    heading: {
      classes: "text-lg font-semibold",
      description: "Heading text (16px by default, 20px at large size)",
    },
    /** @deprecated Use `heading` and set `size` and `as` explicitly. */
    heading1: {
      classes: "text-3xl font-semibold",
      description: "Deprecated large heading for page titles; use heading instead",
    },
    /** @deprecated Use `heading` and set `size` and `as` explicitly. */
    heading2: {
      classes: "text-2xl font-semibold",
      description: "Deprecated medium heading for section titles; use heading instead",
    },
    /** @deprecated Use `heading` and set `size` and `as` explicitly. */
    heading3: {
      classes: "text-lg font-semibold",
      description: "Deprecated small heading for subsections; use heading instead",
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
      classes: "text-tomui-success",
      description: "Success state text",
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

/**
 * TOMUI_TEXT_STYLING - Typography metadata for Figma generator
 *
 * This export provides structured styling information extracted from text.tsx
 * for use by the Figma plugin generator. It documents font sizes, weights,
 * colors, and font families used across all Text variants.
 */
export const TOMUI_TEXT_STYLING = {
  fontSizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
  },
  baseColor: "text-tomui-default",
  variantColors: {
    body: "text-tomui-default",
    secondary: "text-tomui-subtle",
    success: "text-tomui-link",
    error: "text-tomui-danger",
    mono: "text-tomui-default",
    "mono-secondary": "text-tomui-subtle",
  },
  fontFamilies: {
    default: "sans-serif",
    mono: "monospace",
  },
} as const;

// Derived types from TOMUI_TEXT_VARIANTS
export type TomuiTextVariant = keyof typeof TOMUI_TEXT_VARIANTS.variant;
export type TomuiTextSize = keyof typeof TOMUI_TEXT_VARIANTS.size;

type DeprecatedHeading = "heading1" | "heading2" | "heading3";

const DEPRECATED_HEADING_VARIANTS: readonly DeprecatedHeading[] = [
  "heading1",
  "heading2",
  "heading3",
];

function isDeprecatedHeadingVariant(variant: TomuiTextVariant): variant is DeprecatedHeading {
  return (DEPRECATED_HEADING_VARIANTS as readonly TomuiTextVariant[]).includes(variant);
}

function resolveTextSizeClasses(variant: TomuiTextVariant, size: TomuiTextSize): string {
  if (variant === "heading") {
    return size === "lg" ? "text-xl" : "";
  }

  if (isDeprecatedHeadingVariant(variant)) {
    return "";
  }

  if (variant === "mono" || variant === "mono-secondary") {
    // Monospace fonts need to be 1pt smaller than body text to optically match.
    return size === "lg"
      ? TOMUI_TEXT_VARIANTS.size.base.classes
      : TOMUI_TEXT_VARIANTS.size.sm.classes;
  }

  return resolveVariant(TOMUI_TEXT_VARIANTS.size, size, TOMUI_TEXT_DEFAULT_VARIANTS.size).classes;
}

export interface TomuiTextVariantsProps {
  variant?: TomuiTextVariant;
  size?: TomuiTextSize;
}

export function textVariants(props: TomuiTextVariantsProps = {}): string {
  const merged = merge(TOMUI_TEXT_DEFAULT_VARIANTS, props);
  return cn(
    resolveVariant(TOMUI_TEXT_VARIANTS.variant, merged.variant, TOMUI_TEXT_DEFAULT_VARIANTS.variant)
      .classes,
    resolveTextSizeClasses(merged.variant, merged.size),
  );
}

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
 * Text component props.
 *
 * @example
 * ```tsx
 * <Text variant="heading" size="lg" as="h1">Page Title</Text>
 * <Text variant="heading">Decorative heading text</Text>
 * <Text variant="body">Default paragraph text.</Text>
 * <Text variant="secondary" size="sm">Muted helper text</Text>
 * <Text variant="error">Something went wrong</Text>
 * <Text variant="mono">console.log("code")</Text>
 * ```
 */
export interface TextProps {
  /**
   * Text style variant. Determines color, font, and weight.
   * - `"heading"` — Heading text (16px by default, 20px with `size="lg"`; semibold)
   * - `"heading1"` — Deprecated; use `"heading"` (30px, semibold)
   * - `"heading2"` — Deprecated; use `"heading"` (24px, semibold)
   * - `"heading3"` — Deprecated; use `"heading"` (16px, semibold)
   * - `"body"` — Default body text
   * - `"secondary"` — Muted text for secondary information
   * - `"success"` — Success state text
   * - `"error"` — Error state text
   * - `"mono"` — Monospace text for code
   * - `"mono-secondary"` — Muted monospace text
   * @default "body"
   */
  variant?: TomuiTextVariant;
  /**
   * Text size. Supported values depend on the variant:
   * - `"heading"` — 16px when omitted, or 20px with `"lg"`
   * - Body variants — `"xs"` (12px), `"sm"` (13px), `"base"` (14px),
   *   or `"lg"` (16px)
   * - Monospace variants — 13px when omitted, or 14px with `"lg"`
   * @default "base"
   */
  size?: TomuiTextSize;
  /** Whether to use bold font weight (only applies to body variants). */
  bold?: boolean;
  /** Whether to truncate overflowing text with an ellipsis. Adds `truncate min-w-0` classes. */
  truncate?: boolean;
  /**
   * The HTML element to render. Accepts headings (`"h1"`–`"h6"`), block text
   * (`"p"`, `"pre"`), inline text (`"span"`, `"code"`, `"em"`, `"strong"`,
   * `"small"`, `"abbr"`, `"time"`), form-related (`"label"`, `"legend"`),
   * list/definition (`"dt"`, `"dd"`, `"li"`), and `"figcaption"`.
   *
   * - **Optional** for `"heading"` (defaults to `"span"`). Pass the heading
   *   element that reflects this text's place in the document outline.
   * - **Required** for deprecated heading variants (`"heading1"`,
   *   `"heading2"`, `"heading3"`).
   * - **Optional** for body variants (defaults to `"p"`) and monospace
   *   variants (defaults to `"span"`).
   */
  as?: TextElement;
  /** Text content. */
  children?: JSX.Element;
  /** Escape hatch class merged after computed classes. Prefer `class`. */
  DANGEROUS_className?: string;
  /** Escape hatch styles merged after `style`. */
  DANGEROUS_style?: JSX.CSSProperties;
  /** Additional CSS classes merged via `cn()`. */
  class?: string;
  id?: string;
  /** Language of the text content (e.g. `"ja"`). */
  lang?: string;
  ref?: HTMLElement | ((element: HTMLElement) => void) | undefined;
  /** Inline styles. */
  style?: JSX.CSSProperties;
  title?: string;
}

/**
 * Typography component for rendering text with consistent styling.
 * Renders as `<p>` for body variants and `<span>` for headings/mono.
 * Use the `as` prop to set semantic HTML elements for proper document outlines.
 *
 * @example
 * ```tsx
 * <Text variant="heading" size="lg" as="h1">Page Title</Text>
 * <Text variant="heading" as="h2">Section Title</Text>
 * <Text>Default body text</Text>
 * ```
 */
export function Text(props: TextProps): JSX.Element {
  const merged = merge(
    {
      variant: TOMUI_TEXT_DEFAULT_VARIANTS.variant,
      bold: false,
      size: TOMUI_TEXT_DEFAULT_VARIANTS.size,
      truncate: false,
    },
    props,
  );
  const rest = omit(
    merged,
    "as",
    "bold",
    "children",
    "class",
    "DANGEROUS_className",
    "DANGEROUS_style",
    "id",
    "ref",
    "size",
    "style",
    "title",
    "truncate",
    "variant",
  );
  const isCopy = (): boolean =>
    merged.variant === "body" ||
    merged.variant === "secondary" ||
    merged.variant === "success" ||
    merged.variant === "error";
  // Heading variants do not auto-select h1/h2/h3, keeping visual presentation
  // separate from the document outline. Use `as` to opt into semantic HTML.
  const tag = (): TextElement => {
    if (merged.as) return merged.as;
    if (merged.variant === "mono" || merged.variant === "mono-secondary") return "span";
    if (merged.variant === "heading" || isDeprecatedHeadingVariant(merged.variant)) return "span";
    return "p";
  };
  return (
    <Dynamic
      component={tag()}
      data-tomui-component="Text"
      class={cn(
        "text-tomui-default",
        resolveVariant(
          TOMUI_TEXT_VARIANTS.variant,
          merged.variant,
          TOMUI_TEXT_DEFAULT_VARIANTS.variant,
        ).classes,
        resolveTextSizeClasses(merged.variant, merged.size),
        isCopy() && merged.bold ? "font-medium" : "",
        merged.truncate ? "min-w-0 truncate" : "",
        merged.class,
        merged.DANGEROUS_className,
      )}
      style={{ ...merged.style, ...merged.DANGEROUS_style }}
      id={merged.id}
      title={merged.title}
      ref={merged.ref}
      {...rest}
    >
      {merged.children}
    </Dynamic>
  );
}

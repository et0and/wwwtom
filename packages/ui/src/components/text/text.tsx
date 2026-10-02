import { merge, omit } from "solid-js";
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import {
  BOLDABLE_VARIANTS,
  DEFAULT_ELEMENT_BY_VARIANT,
  TOMUI_TEXT_DEFAULT_VARIANTS,
  TOMUI_TEXT_VARIANTS,
  resolveTextSizeClasses,
  type TextElement,
  type TomuiTextSize,
  type TomuiTextVariant,
} from "./variants";

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
   * - **Optional** for body variants (defaults to `"p"`) and monospace
   *   variants (defaults to `"span"`).
   */
  as?: TextElement;
  /** Text content. */
  children?: JSX.Element;
  /** Additional CSS classes, merged after the computed variant classes. */
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
    "id",
    "ref",
    "size",
    "style",
    "title",
    "truncate",
    "variant",
  );
  return (
    <Dynamic
      component={merged.as ?? DEFAULT_ELEMENT_BY_VARIANT[merged.variant]}
      data-tomui-component="Text"
      class={cn(
        "text-tomui-default",
        TOMUI_TEXT_VARIANTS.variant[merged.variant].classes,
        resolveTextSizeClasses(merged.variant, merged.size),
        BOLDABLE_VARIANTS.has(merged.variant) && merged.bold ? "font-medium" : "",
        merged.truncate ? "min-w-0 truncate" : "",
        merged.class,
      )}
      style={merged.style}
      id={merged.id}
      title={merged.title}
      ref={merged.ref}
      {...rest}
    >
      {merged.children}
    </Dynamic>
  );
}

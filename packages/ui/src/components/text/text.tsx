import { For, merge, omit, Show } from "solid-js";
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import {
  BOLDABLE_VARIANTS,
  DEFAULT_ELEMENT_BY_VARIANT,
  TOMUI_TEXT_DEFAULT_VARIANTS,
  blurInStyles,
  resolveTextSizeStyle,
  textStyles,
  type TextElement,
  type TomuiTextSize,
  type TomuiTextVariant,
} from "./variants";

/** Seconds between one character's blur-in and the next. */
const BLUR_IN_STEP = 0.025;

/**
 * Split a string into words and characters, each carrying its global character
 * index so the blur-in delay reads left to right across the whole line. Spaces
 * animate too, so a wrapped line does not pop its gaps in at once.
 */
function splitForBlurIn(text: string) {
  const rawWords = text.split(" ");
  const charCounts = rawWords.map((word) => word.length);
  return rawWords.map((word, wordIndex) => {
    const precedingChars = charCounts
      .slice(0, wordIndex)
      .reduce((sum, count) => sum + count + 1, 0);
    const chars = word
      .split("")
      .map((char, charIndex) => ({ char, globalIndex: precedingChars + charIndex }));
    const hasSpace = wordIndex < rawWords.length - 1;
    return { chars, hasSpace, spaceIndex: precedingChars + word.length };
  });
}

/**
 * The animated text body. The readable text lives in a visually hidden span;
 * the per-character copy is `aria-hidden`, so assistive tech and the accessible
 * name see one clean string.
 */
function BlurInContent(props: { text: string }): JSX.Element {
  return (
    <>
      <span {...stylex.attrs(blurInStyles.srOnly)}>{props.text}</span>
      <span aria-hidden="true">
        <For each={splitForBlurIn(props.text)} keyed={false}>
          {(word) => (
            <>
              <span {...stylex.attrs(blurInStyles.word)}>
                <For each={word().chars} keyed={false}>
                  {(char) => (
                    <span
                      {...stylex.attrs(blurInStyles.char)}
                      style={{ "animation-delay": `${char().globalIndex * BLUR_IN_STEP}s` }}
                    >
                      {char().char}
                    </span>
                  )}
                </For>
              </span>
              <Show when={word().hasSpace}>
                <span
                  {...stylex.attrs(blurInStyles.char)}
                  style={{ "animation-delay": `${word().spaceIndex * BLUR_IN_STEP}s` }}
                >
                  {"\u00A0"}
                </span>
              </Show>
            </>
          )}
        </For>
      </span>
    </>
  );
}

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
  /** Whether to truncate overflowing text with an ellipsis. */
  truncate?: boolean;
  /**
   * Animate the text in with a per-character blur. The child must be a plain
   * string; any other child renders normally. Motion is skipped when the reader
   * asks for reduced motion.
   */
  blurIn?: boolean;
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
  /** Caller styles, merged last so they win over the variant styles. */
  style?: stylex.StyleXStyles;
  id?: string;
  /** Language of the text content (e.g. `"ja"`). */
  lang?: string;
  ref?: HTMLElement | ((element: HTMLElement) => void) | undefined;
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
      blurIn: false,
      bold: false,
      size: TOMUI_TEXT_DEFAULT_VARIANTS.size,
      truncate: false,
    },
    props,
  );
  const rest = omit(
    merged,
    "as",
    "blurIn",
    "bold",
    "children",
    "id",
    "ref",
    "size",
    "style",
    "title",
    "truncate",
    "variant",
  );
  const attrs = () =>
    stylex.attrs(
      textStyles[merged.variant],
      resolveTextSizeStyle(merged.variant, merged.size),
      BOLDABLE_VARIANTS.has(merged.variant) && merged.bold ? textStyles.bold : undefined,
      merged.truncate ? textStyles.truncate : undefined,
      merged.style,
    );
  const content = (): JSX.Element => {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- JSX children narrow to a string for blurIn
    if (merged.blurIn && typeof merged.children === "string") {
      return <BlurInContent text={merged.children} />;
    }
    return merged.children;
  };
  return (
    <Dynamic
      component={merged.as ?? DEFAULT_ELEMENT_BY_VARIANT[merged.variant]}
      data-tomui-component="Text"
      {...attrs()}
      id={merged.id}
      title={merged.title}
      ref={merged.ref}
      {...rest}
    >
      {content()}
    </Dynamic>
  );
}

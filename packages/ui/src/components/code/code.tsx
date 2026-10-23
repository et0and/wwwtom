import { For, merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { monoFont } from "../../styles/primitives.stylex";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeSm } from "../../styles/typography.stylex";

export const TOMUI_CODE_DEFAULT_VARIANTS = {
  lang: "ts",
} as const;

/** Languages the component documents. All share one visual treatment. */
export const TOMUI_CODE_LANGS = ["ts", "tsx", "jsonc", "bash", "css"] as const;

export type TomuiCodeLang = (typeof TOMUI_CODE_LANGS)[number];

const styles = stylex.create({
  pre: {
    margin: 0,
    width: "auto",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    padding: 0,
    fontFamily: monoFont.fontFamily,
    fontSize: fontSizeSm.fontSize,
    lineHeight: "20px",
    color: textColors["--text-color-tomui-subtle"],
  },
  block: {
    minWidth: 0,
    borderRadius: "0.375rem",
    borderWidth: 1,
    borderColor: colors["--color-tomui-fill"],
    backgroundColor: colors["--color-tomui-base"],
  },
  /** Inset for the code inside a block. Passed to the inner Code. */
  blockInset: { padding: "0.625rem" },
  highlighted: { color: textColors["--text-color-tomui-brand"] },
});

/** Template values for `{{key}}` interpolation in `code`. */
export type CodeValues = Record<string, { value: string; highlight?: boolean }>;

/**
 * Code component props.
 *
 * @example
 * ```tsx
 * <Code code="const x = 1;" lang="ts" />
 * <Code code="export API_KEY={{apiKey}}" lang="bash"
 *   values={{ apiKey: { value: "sk_live_123", highlight: true } }}
 * />
 * ```
 */
export interface CodeProps {
  /** The code string to display. */
  code: string;
  /** Language hint for the code content. All languages share one treatment. */
  lang?: TomuiCodeLang;
  /** Template values for `{{key}}` interpolation. Values with `highlight: true` are visually emphasized. */
  values?: CodeValues;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

function renderCodeSegments(code: string, values: CodeValues | undefined): JSX.Element {
  if (!values) return <>{code}</>;
  const parts = code.split(/(\{\{[^}]+\}\})/g);
  return (
    <For each={parts}>
      {(part) => {
        const key = part.slice(2, -2);
        const entry = values[key];
        if (part.startsWith("{{") && entry) {
          return (
            <span {...stylex.attrs(entry.highlight && styles.highlighted)}>{entry.value}</span>
          );
        }
        return <>{part}</>;
      }}
    </For>
  );
}

/**
 * Simple code component without syntax highlighting.
 *
 * Renders code in a monospace font. For a bordered container version, use
 * `Code.Block` or `CodeBlock`.
 */
function CodeComponent(props: CodeProps): JSX.Element {
  const merged = merge({ lang: TOMUI_CODE_DEFAULT_VARIANTS.lang }, props);
  const rest = omit(merged, "code", "lang", "style", "values");
  return (
    <pre data-tomui-component="Code" {...stylex.attrs(styles.pre, merged.style)} {...rest}>
      {renderCodeSegments(merged.code, merged.values)}
    </pre>
  );
}

/**
 * CodeBlock component props — code inside a bordered container.
 *
 * @example
 * ```tsx
 * <Code.Block lang="tsx" code={`const greeting = "Hello!";`} />
 * ```
 */
export interface CodeBlockProps {
  /** The code string to display. */
  code: string;
  /** Language hint for the code content. */
  lang?: TomuiCodeLang;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

/**
 * Code block with border and background container.
 *
 * A styled wrapper around Code that adds a bordered container with surface
 * background. Useful for displaying code snippets with visual separation from
 * surrounding text.
 */
function CodeBlockComponent(props: CodeBlockProps): JSX.Element {
  const merged = merge({ lang: TOMUI_CODE_DEFAULT_VARIANTS.lang }, props);
  return (
    <div {...stylex.attrs(styles.block, merged.style)}>
      <CodeComponent lang={merged.lang} code={merged.code} style={styles.blockInset} />
    </div>
  );
}

// Export Code with Block sub-component
export const Code = Object.assign(CodeComponent, {
  Block: CodeBlockComponent,
});

// Backward-compatible standalone export
export const CodeBlock = CodeBlockComponent;

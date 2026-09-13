import { For, merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

/** Code language variant definitions. */
export const TOMUI_CODE_VARIANTS = {
  lang: {
    ts: {
      classes: "",
      description: "TypeScript code",
    },
    tsx: {
      classes: "",
      description: "TypeScript JSX code",
    },
    jsonc: {
      classes: "",
      description: "JSON with comments",
    },
    bash: {
      classes: "",
      description: "Shell/Bash commands",
    },
    css: {
      classes: "",
      description: "CSS styles",
    },
  },
} as const;

export const TOMUI_CODE_DEFAULT_VARIANTS = {
  lang: "ts",
} as const;

// Derived types from TOMUI_CODE_VARIANTS
export type TomuiCodeLang = keyof typeof TOMUI_CODE_VARIANTS.lang;

export interface TomuiCodeVariantsProps {
  /**
   * Language hint for the code content.
   * - `"ts"` — TypeScript code
   * - `"tsx"` — TypeScript JSX code
   * - `"jsonc"` — JSON with comments
   * - `"bash"` — Shell/Bash commands
   * - `"css"` — CSS styles
   * @default "ts"
   */
  lang?: TomuiCodeLang;
}

export function codeVariants(props: TomuiCodeVariantsProps = {}): string {
  const merged = merge(TOMUI_CODE_DEFAULT_VARIANTS, props);
  return cn(
    // Base styles
    "m-0 w-auto rounded-none border-none bg-transparent p-0 font-mono text-sm leading-[20px] text-tomui-subtle",
    // Apply lang-specific styles (fallback to default if lang not in map)
    resolveVariant(TOMUI_CODE_VARIANTS.lang, merged.lang, TOMUI_CODE_DEFAULT_VARIANTS.lang).classes,
  );
}

// Legacy type alias for backwards compatibility
export type CodeLang = TomuiCodeLang;

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
export interface CodeProps extends TomuiCodeVariantsProps {
  /** The code string to display. */
  code: string;
  /** Template values for `{{key}}` interpolation. Values with `highlight: true` are visually emphasized. */
  values?: CodeValues;
  /** Additional CSS classes merged via `cn()`. */
  class?: string;
  /** Inline styles. */
  style?: JSX.CSSProperties;
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
            <span class={entry.highlight ? "text-tomui-brand" : undefined}>{entry.value}</span>
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
 * Renders code in a monospace font with customizable language metadata.
 * For a bordered container version, use `Code.Block` or `CodeBlock`.
 */
function CodeComponent(props: CodeProps): JSX.Element {
  const merged = merge({ lang: TOMUI_CODE_DEFAULT_VARIANTS.lang }, props);
  const rest = omit(merged, "class", "code", "lang", "style", "values");
  return (
    <pre
      data-tomui-component="Code"
      class={cn(codeVariants({ lang: merged.lang }), merged.class)}
      style={merged.style}
      {...rest}
    >
      {renderCodeSegments(merged.code, merged.values)}
    </pre>
  );
}

/**
 * CodeBlock component props — code inside a bordered container.
 *
 * @example
 * ```tsx
 * <CodeBlock lang="tsx" code={`const greeting = "Hello!";`} />
 * ```
 */
export interface CodeBlockProps {
  /** The code string to display. */
  code: string;
  /**
   * Language hint for the code content.
   * @default "ts"
   */
  lang?: CodeLang;
}

/**
 * Code block with border and background container.
 *
 * A styled wrapper around Code that adds a bordered container with surface background.
 * Useful for displaying code snippets with visual separation from surrounding content.
 */
function CodeBlockComponent(props: CodeBlockProps): JSX.Element {
  const merged = merge({ lang: TOMUI_CODE_DEFAULT_VARIANTS.lang }, props);
  return (
    <div
      data-tomui-component="CodeBlock"
      class="min-w-0 rounded-md border border-tomui-fill bg-tomui-base [&>pre]:p-2.5!"
    >
      <CodeComponent lang={merged.lang} code={merged.code} />
    </div>
  );
}

// Export Code with Block sub-component
export const Code = Object.assign(CodeComponent, {
  Block: CodeBlockComponent,
});

// Backward-compatible standalone export
export const CodeBlock = CodeBlockComponent;

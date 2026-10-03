import * as stylex from "@stylexjs/stylex";
import { createSignal, merge, omit, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button/button";
import { colors } from "../../styles/colors.stylex";
import { monoFont, radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_EMPTY_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiEmptySize = "sm" | "base" | "lg";

const styles = stylex.create({
  root: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors["--color-tomui-fill"],
    borderRadius: radius.xl.borderRadius,
    backgroundColor: colors["--color-tomui-control"],
    color: textColors["--text-color-tomui-default"],
  },
  sizeSm: { padding: "2rem 1.5rem", gap: "1rem" },
  sizeBase: { padding: "4rem 2.5rem", gap: "1.5rem" },
  sizeLg: { padding: "5rem 3rem", gap: "2rem" },
  body: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" },
  title: { fontSize: "1.5rem", fontWeight: 600 },
  description: {
    maxWidth: "35rem",
    textAlign: "center",
    textWrap: "balance",
    lineHeight: "1.5",
    color: textColors["--text-color-tomui-subtle"],
  },
  command: {
    position: "relative",
    display: "inline-flex",
    height: "2.5rem",
    maxWidth: "80%",
    alignItems: "center",
    gap: "0.5rem",
    paddingInlineStart: "0.75rem",
    paddingInlineEnd: "0.5rem",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-overlay"],
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"] + ", 0 1px 2px 0 rgb(0 0 0 / 0.05)",
    willChange: "transform",
    ...monoFont,
  },
  commandRow: { display: "inline-flex", minWidth: 0, alignItems: "baseline", gap: "0.5rem" },
  commandPrompt: { color: textColors["--text-color-tomui-subtle"], userSelect: "none" },
  /** The command scrolls rather than wraps, so its scrollbar is hidden. */
  commandText: {
    overflowX: "scroll",
    fontSize: "0.875rem",
    whiteSpace: "nowrap",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "::-webkit-scrollbar": { display: "none" },
  },
  checkMark: {
    // StyleX only accepts from/to frames, so the three-step bounce is defined
    // in tomui-binding.css and referenced by name.
    animationName: "bounce-in",
    animationDuration: "0.4s",
    animationTimingFunction: "ease-out",
    color: textColors["--text-color-tomui-success"],
  },
});

export interface TomuiEmptyVariantsProps {
  /**
   * Size of the empty state container.
   * - `"sm"` — Compact empty state for smaller containers
   * - `"base"` — Default empty state size
   * - `"lg"` — Large empty state for prominent placement
   * @default "base"
   */
  size?: TomuiEmptySize;
}

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiEmptySize, stylex.StyleXStyles>;

export function emptyVariants(props: TomuiEmptyVariantsProps = {}) {
  const merged = merge(TOMUI_EMPTY_DEFAULT_VARIANTS, props);
  return [styles.root, sizeStyles[merged.size]];
}

/**
 * Empty state component props.
 *
 * @example
 * ```tsx
 * <Empty
 *   icon={<PackageIcon />}
 *   title="No packages found"
 *   description="Get started by installing your first package."
 *   commandLine="npm install @tom/ui"
 * />
 * ```
 */
export interface EmptyProps extends TomuiEmptyVariantsProps {
  /** Decorative icon displayed above the title. */
  icon?: JSX.Element;
  /** Primary heading text for the empty state. */
  title: string;
  /** Secondary description text displayed below the title. */
  description?: string;
  /** Shell command displayed in a copyable code block. */
  commandLine?: string;
  /** Additional content (buttons, links) rendered below the description. */
  contents?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  ref?: HTMLDivElement | ((element: HTMLDivElement) => void) | undefined;
}

interface CopyResetTimer {
  current: ReturnType<typeof setTimeout> | undefined;
}

function CheckMarkIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 256 256"
      fill="currentColor"
      {...stylex.attrs(styles.checkMark)}
      aria-hidden="true"
    >
      <path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69l122.34-122.35a8 8 0 0 1 11.32 11.32Z" />
    </svg>
  );
}

function CopyMarkIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      stroke-width="16"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="40" y="40" width="120" height="120" rx="8" />
      <path d="M200 88v104a16 16 0 0 1-16 16H88" />
    </svg>
  );
}

/**
 * Placeholder shown when a list, table, or page has no content to display.
 *
 * @example
 * ```tsx
 * <Empty title="No results found" description="Try adjusting your search." />
 * ```
 */
export function Empty(props: EmptyProps): JSX.Element {
  const merged = merge({ size: TOMUI_EMPTY_DEFAULT_VARIANTS.size }, props);
  const rest = omit(
    merged,
    "style",
    "commandLine",
    "contents",
    "description",
    "icon",
    "ref",
    "size",
    "title",
  );
  const [copied, setCopied] = createSignal(false);
  const timer: CopyResetTimer = { current: undefined };
  onCleanup(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
  });

  const copyCommand = (): void => {
    const command = merged.commandLine;
    if (!command) return;
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      void clipboard.writeText(command);
    }
    setCopied(true);
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div
      data-tomui-component="Empty"
      {...stylex.attrs(...emptyVariants({ size: merged.size }), merged.style)}
      ref={merged.ref}
      {...rest}
    >
      <Show when={merged.icon}>{merged.icon}</Show>
      <div {...stylex.attrs(styles.body)}>
        <h2 {...stylex.attrs(styles.title)}>{merged.title}</h2>

        <Show when={merged.description}>
          <p {...stylex.attrs(styles.description)}>{merged.description}</p>
        </Show>
      </div>

      <Show when={merged.commandLine}>
        <div {...stylex.attrs(styles.command)}>
          <span {...stylex.attrs(styles.commandRow)}>
            <span {...stylex.attrs(styles.commandPrompt)}>$</span>
            <span {...stylex.attrs(styles.commandText)}>{merged.commandLine}</span>
          </span>
          <Button
            style={styles.commandPrompt}
            size="sm"
            variant="ghost"
            form="square"
            aria-label="Copy command"
            onClick={copyCommand}
          >
            <Show when={copied()} fallback={<CopyMarkIcon />}>
              <CheckMarkIcon />
            </Show>
          </Button>
        </div>
      </Show>

      <Show when={merged.contents}>{merged.contents}</Show>
    </div>
  );
}

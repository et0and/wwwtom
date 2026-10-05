import * as stylex from "@stylexjs/stylex";
import { createSignal, merge, omit, onCleanup } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button/button";
import { inputVariants } from "../input/input";
import { Tooltip } from "../tooltip/tooltip";
import { colors } from "../../styles/colors.stylex";
import { monoFont } from "../../styles/primitives.stylex";

const COPIED_FEEDBACK_MS = 1500;

interface CopyResetTimer {
  current: ReturnType<typeof setTimeout> | undefined;
}

export const TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS = {
  size: "lg",
} as const;

export type TomuiClipboardTextSize = "sm" | "base" | "lg";

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    // Overrides the horizontal padding that inputVariants sets, so the text
    // label controls its own inset.
    paddingInline: 0,
    backgroundColor: colors["--color-tomui-base"],
    ...monoFont,
  },
  sizeSm: { fontSize: "0.75rem" },
  sizeBase: { fontSize: "0.8125rem" },
  sizeLg: { fontSize: "0.8125rem" },
  copyButton: {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: "inherit",
    borderBottomRightRadius: "inherit",
    borderLeftWidth: "1px",
    borderLeftColor: colors["--color-tomui-line"],
    paddingInline: "0.75rem",
    transitionProperty: "all",
    transitionDuration: "200ms",
    ":focus": {
      boxShadow:
        "inset 0 0 0 1.5px color-mix(in srgb, " +
        colors["--color-tomui-focus"] +
        " 50%, transparent)",
    },
    ":focus-visible": {
      boxShadow: "inset 0 0 0 2px " + colors["--color-tomui-brand"],
    },
  },
  /** The two marks cross-fade by sliding vertically past each other. */
  markStack: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    transitionProperty: "all",
    transitionDuration: "200ms",
  },
  slideInitial: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    opacity: 0,
    transform: "translateY(100%)",
  },
  slideAnimate: { opacity: 1, transform: "translateY(0)" },
  slideEnd: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    opacity: 0,
    transform: "translateY(-100%)",
  },
  label: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingInlineStart: "1rem",
    paddingInlineEnd: "0.5rem",
  },
});

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} satisfies Record<TomuiClipboardTextSize, stylex.StyleXStyles>;

/** ClipboardText sizes map one to one onto Button sizes. */
const buttonSize = {
  sm: "sm",
  base: "base",
  lg: "lg",
} as const satisfies Record<TomuiClipboardTextSize, "sm" | "base" | "lg">;

export interface TomuiClipboardTextVariantsProps {
  /**
   * Size of the clipboard text field.
   * - `"sm"` — Small clipboard text for compact UIs
   * - `"base"` — Default clipboard text size
   * - `"lg"` — Large clipboard text for prominent display
   * @default "lg"
   */
  size?: TomuiClipboardTextSize;
}

export function clipboardTextVariants(
  props: TomuiClipboardTextVariantsProps = {},
): stylex.StyleXStyles[] {
  const merged = merge(TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS, props);
  return [styles.root, sizeStyles[merged.size]];
}

/** Tooltip config for the copy button. Shows tooltip on hover; the popup text swaps to `copiedText` after copying. */
export interface ClipboardTextTooltip {
  /** Text shown in tooltip on hover. @default "Copy" */
  text?: string;
  /** Text shown in the tooltip after copying. @default "Copied" */
  copiedText?: string;
  /** Tooltip placement. @default "top" */
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * ClipboardText component props.
 *
 * @example
 * ```tsx
 * <ClipboardText text="sk_live_abc123" />
 * <ClipboardText text="npm install @tom/ui" size="sm" />
 * ```
 */
export interface ClipboardTextProps extends TomuiClipboardTextVariantsProps {
  /** The text to display and copy to clipboard. */
  text: string;
  /** If provided, this text will be copied to clipboard instead of the `text` prop. */
  textToCopy?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  /** Callback fired after text is copied to clipboard. */
  onCopy?: () => void;
  /**
   * Tooltip config. Shows tooltip on hover; the popup swaps to `copiedText` after copying.
   * @example
   * ```tsx
   * <ClipboardText
   *   text="abc123"
   *   tooltip={{ text: "Copy", copiedText: "Copied!", side: "top" }}
   * />
   * ```
   */
  tooltip?: ClipboardTextTooltip;
  /** Accessible labels for i18n. */
  labels?: {
    /** @default "Copy to clipboard" */
    copyAction?: string;
  };
  ref?: HTMLDivElement | ((element: HTMLDivElement) => void) | undefined;
}

function CheckMarkIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
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
 * Read-only text field with a one-click copy-to-clipboard button.
 *
 * @example
 * ```tsx
 * <ClipboardText text="0c239dd2" />
 * ```
 */
export function ClipboardText(props: ClipboardTextProps): JSX.Element {
  const merged = merge({ size: TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS.size }, props);
  const rest = omit(
    merged,
    "style",
    "labels",
    "onCopy",
    "ref",
    "size",
    "text",
    "textToCopy",
    "tooltip",
  );
  const [copied, setCopied] = createSignal(false);
  const timer: CopyResetTimer = { current: undefined };
  onCleanup(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
  });
  const tooltipText = (): string => merged.tooltip?.text ?? "Copy";
  const copiedText = (): string => merged.tooltip?.copiedText ?? "Copied";
  const copyActionLabel = (): string => merged.labels?.copyAction ?? "Copy to clipboard";
  const sizeConfig = (): "sm" | "base" | "lg" => buttonSize[merged.size];

  const finishCopy = (): void => {
    setCopied(true);
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    merged.onCopy?.();
  };

  const copyFallback = (value: string): void => {
    if (!("document" in globalThis)) return;
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    finishCopy();
  };

  const copyToClipboard = (): void => {
    const value = merged.textToCopy ?? merged.text;
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      clipboard.writeText(value).then(finishCopy, () => copyFallback(value));
    } else {
      copyFallback(value);
    }
  };

  const copyButton = (): JSX.Element => (
    <Button
      size={sizeConfig()}
      variant="ghost"
      style={styles.copyButton}
      onClick={copyToClipboard}
      aria-label={copyActionLabel()}
    >
      <span
        {...stylex.attrs(styles.markStack, copied() ? styles.slideAnimate : styles.slideInitial)}
      >
        <CheckMarkIcon />
      </span>
      <span {...stylex.attrs(styles.markStack, copied() ? styles.slideEnd : styles.slideAnimate)}>
        <CopyMarkIcon />
      </span>
    </Button>
  );

  return (
    <div
      data-tomui-component="ClipboardText"
      {...stylex.attrs(
        ...inputVariants({ size: sizeConfig() }),
        ...clipboardTextVariants({ size: merged.size }),
        merged.style,
      )}
      ref={merged.ref}
      {...rest}
    >
      <span {...stylex.attrs(styles.label)}>{merged.text}</span>
      {merged.tooltip ? (
        <Tooltip
          content={copied() ? copiedText() : tooltipText()}
          side={merged.tooltip.side ?? "top"}
        >
          {copyButton()}
        </Tooltip>
      ) : (
        copyButton()
      )}
      <span class="sr-only" aria-live="polite">
        {copied() ? copiedText() : ""}
      </span>
    </div>
  );
}

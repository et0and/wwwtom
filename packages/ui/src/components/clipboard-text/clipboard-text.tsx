import { createSignal, merge, omit, onCleanup } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button/button";
import { inputVariants } from "../input/input";
import { Tooltip } from "../tooltip/tooltip";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

const COPIED_FEEDBACK_MS = 1500;

interface CopyResetTimer {
  current: ReturnType<typeof setTimeout> | undefined;
}

/** ClipboardText size variant definitions mapping sizes to their Tailwind classes. */
export const TOMUI_CLIPBOARD_TEXT_VARIANTS = {
  size: {
    sm: {
      classes: "text-xs",
      buttonSize: "sm" as const,
      description: "Small clipboard text for compact UIs",
    },
    base: {
      classes: "text-sm",
      buttonSize: "base" as const,
      description: "Default clipboard text size",
    },
    lg: {
      classes: "text-sm",
      buttonSize: "lg" as const,
      description: "Large clipboard text for prominent display",
    },
  },
} as const;

export const TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS = {
  size: "lg",
} as const;

const clipboardTextAnimations = {
  slide: {
    initial:
      "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 translate-y-full",
    animate: "translate-y-0 opacity-100",
    end: "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 -translate-y-full",
  },
} as const;

// Derived types from TOMUI_CLIPBOARD_TEXT_VARIANTS
export type TomuiClipboardTextSize = keyof typeof TOMUI_CLIPBOARD_TEXT_VARIANTS.size;

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

export function clipboardTextVariants(props: TomuiClipboardTextVariantsProps = {}): string {
  const merged = merge(TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS, props);
  return cn(
    // Base styles
    "flex items-center overflow-hidden bg-tomui-base px-0 font-mono",
    // Apply size styles from TOMUI_CLIPBOARD_TEXT_VARIANTS
    resolveVariant(
      TOMUI_CLIPBOARD_TEXT_VARIANTS.size,
      merged.size,
      TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS.size,
    ).classes,
  );
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
  /** Additional CSS classes merged via `cn()`. */
  class?: string;
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
    "class",
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
  const sizeConfig = () =>
    resolveVariant(
      TOMUI_CLIPBOARD_TEXT_VARIANTS.size,
      merged.size,
      TOMUI_CLIPBOARD_TEXT_DEFAULT_VARIANTS.size,
    );

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
      size={sizeConfig().buttonSize}
      variant="ghost"
      class={cn(
        "relative isolate overflow-hidden rounded-l-none rounded-r-[inherit] border-l! border-tomui-line! px-3 transition-all duration-200",
        "focus:ring-tomui-focus/50 focus:ring-inset",
        "focus-visible:ring-2 focus-visible:ring-tomui-brand focus-visible:ring-inset",
      )}
      onClick={copyToClipboard}
      aria-label={copyActionLabel()}
    >
      <span
        class={cn(
          "flex items-center gap-1 transition-all duration-200",
          copied() ? clipboardTextAnimations.slide.animate : clipboardTextAnimations.slide.initial,
        )}
      >
        <CheckMarkIcon />
      </span>
      <span
        class={cn(
          "flex items-center justify-center transition-all duration-200",
          copied() ? clipboardTextAnimations.slide.end : clipboardTextAnimations.slide.animate,
        )}
      >
        <CopyMarkIcon />
      </span>
    </Button>
  );

  return (
    <div
      data-tomui-component="ClipboardText"
      class={cn(
        inputVariants({ size: sizeConfig().buttonSize }),
        clipboardTextVariants({ size: merged.size }),
        merged.class,
      )}
      ref={merged.ref}
      {...rest}
    >
      <span class="grow truncate ps-4 pe-2">{merged.text}</span>
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

import { createSignal, merge, omit, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button/button";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

/** Empty state size variant definitions mapping sizes to their Tailwind classes. */
export const TOMUI_EMPTY_VARIANTS = {
  size: {
    sm: {
      classes: "px-6 py-8 gap-4",
      description: "Compact empty state for smaller containers",
    },
    base: {
      classes: "px-10 py-16 gap-6",
      description: "Default empty state size",
    },
    lg: {
      classes: "px-12 py-20 gap-8",
      description: "Large empty state for prominent placement",
    },
  },
} as const;

export const TOMUI_EMPTY_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiEmptySize = keyof typeof TOMUI_EMPTY_VARIANTS.size;

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

export function emptyVariants(props: TomuiEmptyVariantsProps = {}): string {
  const merged = merge(TOMUI_EMPTY_DEFAULT_VARIANTS, props);
  return cn(
    "flex w-full flex-col items-center rounded-xl border border-tomui-fill bg-tomui-control text-tomui-default",
    resolveVariant(TOMUI_EMPTY_VARIANTS.size, merged.size, TOMUI_EMPTY_DEFAULT_VARIANTS.size)
      .classes,
  );
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
  /** Additional CSS classes merged via `cn()`. */
  class?: string;
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
      class="animate-bounce-in text-tomui-success"
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
      class="text-tomui-inactive group-hover:text-tomui-brand"
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
    "class",
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
      class={cn(emptyVariants({ size: merged.size }), merged.class)}
      ref={merged.ref}
      {...rest}
    >
      <Show when={merged.icon}>{merged.icon}</Show>
      <h2 class="text-2xl font-semibold">{merged.title}</h2>

      <Show when={merged.description}>
        <p class="max-w-140 text-center text-tomui-subtle">{merged.description}</p>
      </Show>

      <Show when={merged.commandLine}>
        <div
          class={cn(
            "group/cmd relative inline-flex h-10 max-w-8/10 transform-gpu items-center gap-2 rounded-lg font-mono shadow-sm",
            "bg-tomui-overlay pr-2 pl-3",
            "transition-all duration-300 hover:border-tomui-interact/80 hover:shadow-md",
            "border border-tomui-fill/60",
          )}
        >
          <span class="text-xs text-tomui-inactive select-none">$</span>
          <span class="no-scrollbar overflow-scroll text-base whitespace-nowrap text-tomui-brand">
            {merged.commandLine}
          </span>
          <Button
            class="group"
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

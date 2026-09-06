import { createUniqueId, merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

/** Tooltip side variant definitions mapping positions to their Tailwind classes. */
export const TOMUI_TOOLTIP_VARIANTS = {
  side: {
    top: {
      classes: "",
      description: "Tooltip appears above the trigger",
    },
    bottom: {
      classes: "",
      description: "Tooltip appears below the trigger",
    },
    left: {
      classes: "",
      description: "Tooltip appears to the left of the trigger",
    },
    right: {
      classes: "",
      description: "Tooltip appears to the right of the trigger",
    },
  },
} as const;

export const TOMUI_TOOLTIP_DEFAULT_VARIANTS = {
  side: "top",
} as const;

// Derived types from TOMUI_TOOLTIP_VARIANTS
export type TomuiTooltipSide = keyof typeof TOMUI_TOOLTIP_VARIANTS.side;

export interface TomuiTooltipVariantsProps {
  /**
   * Preferred side of the trigger to render the tooltip.
   * - `"top"` — Tooltip appears above the trigger
   * - `"bottom"` — Tooltip appears below the trigger
   * - `"left"` — Tooltip appears to the left of the trigger
   * - `"right"` — Tooltip appears to the right of the trigger
   * @default "top"
   */
  side?: TomuiTooltipSide;
}

export function tooltipVariants(props: TomuiTooltipVariantsProps = {}): string {
  const merged = merge(TOMUI_TOOLTIP_DEFAULT_VARIANTS, props);
  return cn(
    // Base styles
    "flex origin-[var(--transform-origin)] flex-col rounded-md bg-tomui-base px-2.5 py-1.5 text-sm text-tomui-default",
    "shadow-md outline-1 outline-tomui-line",
    // Apply side-specific styles (currently none, but extensible)
    resolveVariant(TOMUI_TOOLTIP_VARIANTS.side, merged.side, TOMUI_TOOLTIP_DEFAULT_VARIANTS.side)
      .classes,
  );
}

export function TooltipProvider(props: { children?: JSX.Element }): JSX.Element {
  return <>{props.children}</>;
}

/** Alignment on the axis perpendicular to `side`. */
export type TooltipAlign = "start" | "center" | "end";

const TOMUI_TOOLTIP_POSITIONS = {
  top: "bottom-full left-1/2 mb-2.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2.5 -translate-x-1/2",
  left: "top-1/2 right-full mr-2.5 -translate-y-1/2",
  right: "top-1/2 left-full ml-2.5 -translate-y-1/2",
} satisfies Record<TomuiTooltipSide, string>;

/**
 * Tooltip component props.
 *
 * @example
 * ```tsx
 * <Tooltip content="Add new item">Add</Tooltip>
 * ```
 */
export type TooltipProps = {
  /**
   * Alignment on the axis perpendicular to `side`.
   * - `"start"` — Align to the start edge
   * - `"center"` — Center-aligned
   * - `"end"` — Align to the end edge
   */
  align?: TooltipAlign;
  /** Element that triggers the tooltip on hover/focus. */
  children?: JSX.Element;
  /** Additional CSS classes merged via `cn()`. */
  class?: string;
  /** How long to wait before closing the tooltip, in milliseconds. Accepted for API parity; closing is CSS-driven. */
  closeDelay?: number;
  /** Content to display inside the tooltip popup. */
  content: JSX.Element;
  /** How long to wait before opening the tooltip, in milliseconds. Accepted for API parity; opening is CSS-driven. */
  delay?: number;
  ref?: HTMLSpanElement | ((element: HTMLSpanElement) => void) | undefined;
  /**
   * Preferred side of the trigger to render the tooltip.
   * @default "top"
   */
  side?: TomuiTooltipSide;
};

/**
 * Accessible popup that shows additional information on hover/focus.
 * Wrap your app or section with `<TooltipProvider>` to enable delay grouping.
 *
 * @example
 * ```tsx
 * <Tooltip content="Save changes">Save</Tooltip>
 * ```
 */
export function Tooltip(props: TooltipProps): JSX.Element {
  const merged = merge(
    { align: "center" as TooltipAlign, side: TOMUI_TOOLTIP_DEFAULT_VARIANTS.side },
    props,
  );
  const rest = omit(
    merged,
    "align",
    "children",
    "class",
    "closeDelay",
    "content",
    "delay",
    "ref",
    "side",
  );
  const popupId = createUniqueId();
  return (
    <span
      data-tomui-component="Tooltip"
      data-side={merged.side}
      class={cn("group/tooltip relative inline-flex cursor-default", merged.class)}
      tabindex={0}
      aria-describedby={popupId}
      ref={merged.ref}
      {...rest}
    >
      {merged.children}
      <span
        id={popupId}
        role="tooltip"
        data-side={merged.side}
        data-align={merged.align}
        class={cn(
          "pointer-events-none absolute z-50",
          "invisible opacity-0 transition-[opacity,scale] duration-150",
          "group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100",
          TOMUI_TOOLTIP_POSITIONS[merged.side],
          tooltipVariants({ side: merged.side }),
        )}
      >
        {merged.content}
      </span>
    </span>
  );
}

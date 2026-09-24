import type { JSX } from "@solidjs/web";
import { createUniqueId, merge, omit, onCleanup, Show } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { createDisclosureState } from "../../utils/state";

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

export type TomuiTooltipSide = keyof typeof TOMUI_TOOLTIP_VARIANTS.side;

export interface TomuiTooltipVariantsProps {
  side?: TomuiTooltipSide;
}

export function tooltipVariants(props: TomuiTooltipVariantsProps = {}): string {
  const merged = merge(TOMUI_TOOLTIP_DEFAULT_VARIANTS, props);
  return cn(
    "flex origin-[var(--transform-origin)] flex-col rounded-md bg-tomui-base px-2.5 py-1.5 text-sm text-tomui-default",
    "shadow-md outline-1 outline-tomui-line",
    "transition-[transform,scale,opacity] duration-150",
    "data-[starting-style]:scale-90 data-[starting-style]:opacity-0",
    "data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
    "data-[instant]:duration-0",
    resolveVariant(TOMUI_TOOLTIP_VARIANTS.side, merged.side, TOMUI_TOOLTIP_DEFAULT_VARIANTS.side)
      .classes,
  );
}

export type TooltipAlign = "start" | "center" | "end";

const TOMUI_TOOLTIP_POSITIONS = {
  top: "bottom-full left-1/2 mb-2.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2.5 -translate-x-1/2",
  left: "top-1/2 right-full mr-2.5 -translate-y-1/2",
  right: "top-1/2 left-full ml-2.5 -translate-y-1/2",
} satisfies Record<TomuiTooltipSide, string>;

let globalWarmedUp = false;
let globalCoolDownTimeout: ReturnType<typeof setTimeout> | undefined;
let globalSkipDelayTimeout: ReturnType<typeof setTimeout> | undefined;
const openTooltips = new Map<string, () => void>();

export type TooltipProps = {
  align?: TooltipAlign;
  children?: JSX.Element;
  class?: string;
  content: JSX.Element;
  ref?: HTMLSpanElement | ((element: HTMLSpanElement) => void) | undefined;
  side?: TomuiTooltipSide;
  openDelay?: number;
  closeDelay?: number;
  skipDelayDuration?: number;
  disabled?: boolean;
};

export function Tooltip(props: TooltipProps): JSX.Element {
  const merged = merge(
    {
      align: "center" as TooltipAlign,
      side: TOMUI_TOOLTIP_DEFAULT_VARIANTS.side,
      openDelay: 700,
      closeDelay: 300,
      skipDelayDuration: 300,
      disabled: false,
    },
    props,
  );
  const rest = omit(
    merged,
    "align",
    "children",
    "class",
    "content",
    "ref",
    "side",
    "openDelay",
    "closeDelay",
    "skipDelayDuration",
    "disabled",
  );

  const popupId = createUniqueId();
  const state = createDisclosureState({});
  let closeTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let openTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let isHovered = false;
  let isFocused = false;

  const cancelOpening = () => {
    clearTimeout(openTimeoutId);
    openTimeoutId = undefined;
  };

  const cancelClosing = () => {
    clearTimeout(closeTimeoutId);
    closeTimeoutId = undefined;
  };

  const closeOpenTooltips = () => {
    for (const [id, hide] of openTooltips) {
      if (id !== popupId) hide();
    }
  };

  const showTooltip = () => {
    cancelClosing();
    cancelOpening();
    closeOpenTooltips();
    openTooltips.set(popupId, () => state.close());
    globalWarmedUp = true;
    state.open();
    clearTimeout(globalCoolDownTimeout);
    globalCoolDownTimeout = undefined;
    clearTimeout(globalSkipDelayTimeout);
    globalSkipDelayTimeout = undefined;
  };

  const warmupTooltip = () => {
    closeOpenTooltips();
    openTooltips.set(popupId, () => state.close());

    if (!state.isOpen() && !openTimeoutId && !globalWarmedUp) {
      openTimeoutId = setTimeout(() => {
        openTimeoutId = undefined;
        globalWarmedUp = true;
        showTooltip();
      }, merged.openDelay);
    } else if (!state.isOpen()) {
      showTooltip();
    }
  };

  const openTooltip = (immediate = false) => {
    if (merged.disabled) return;
    if (!immediate && merged.openDelay > 0 && !closeTimeoutId && !globalSkipDelayTimeout) {
      warmupTooltip();
    } else {
      showTooltip();
    }
  };

  const hideTooltip = (immediate = false) => {
    if (immediate || merged.closeDelay <= 0) {
      cancelClosing();
      state.close();
    } else if (!closeTimeoutId) {
      closeTimeoutId = setTimeout(() => {
        state.close();
        closeTimeoutId = undefined;
      }, merged.closeDelay);
    }

    clearTimeout(globalSkipDelayTimeout);
    globalSkipDelayTimeout = setTimeout(() => {
      globalSkipDelayTimeout = undefined;
    }, merged.skipDelayDuration);

    cancelOpening();

    if (globalWarmedUp) {
      clearTimeout(globalCoolDownTimeout);
      globalCoolDownTimeout = setTimeout(() => {
        openTooltips.delete(popupId);
        globalWarmedUp = false;
      }, merged.closeDelay);
    }
  };

  const handleShow = () => {
    if (!state.isOpen() && (isHovered || isFocused)) {
      openTooltip(isFocused);
    }
  };

  const handleHide = (immediate = false) => {
    if (state.isOpen() && !isHovered && !isFocused) {
      hideTooltip(immediate);
    }
  };

  onCleanup(() => {
    cancelOpening();
    cancelClosing();
    openTooltips.delete(popupId);
  });

  return (
    <span
      data-tomui-component="Tooltip"
      data-side={merged.side}
      class={cn("group/tooltip relative inline-flex cursor-default", merged.class)}
      tabindex={0}
      aria-describedby={state.isOpen() ? popupId : undefined}
      ref={merged.ref}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch" || merged.disabled) return;
        isHovered = true;
        handleShow();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "touch") return;
        isHovered = false;
        isFocused = false;
        if (state.isOpen()) handleHide();
        else cancelOpening();
      }}
      onPointerDown={() => {
        isHovered = false;
        isFocused = false;
        handleHide(true);
      }}
      onClick={() => {
        isHovered = false;
        isFocused = false;
        handleHide(true);
      }}
      onFocus={() => {
        if (merged.disabled) return;
        isFocused = true;
        handleShow();
      }}
      onBlur={() => {
        isFocused = false;
        handleHide(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && state.isOpen()) {
          e.stopPropagation();
          hideTooltip(true);
        }
      }}
      {...rest}
    >
      {merged.children}
      <Show when={state.isOpen()}>
        <span
          id={popupId}
          role="tooltip"
          data-side={merged.side}
          data-align={merged.align}
          class={cn(
            "pointer-events-none absolute z-50",
            "visible opacity-100",
            TOMUI_TOOLTIP_POSITIONS[merged.side],
            tooltipVariants({ side: merged.side }),
            "tomui-tooltip-popup",
          )}
        >
          {merged.content}
        </span>
      </Show>
    </span>
  );
}

import type { JSX } from "@solidjs/web";
import { createUniqueId, merge, omit, onCleanup, Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { createDisclosureState } from "../../utils/state";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeSm } from "../../styles/typography.stylex";

export const TOMUI_TOOLTIP_DEFAULT_VARIANTS = {
  side: "top",
} as const;

export type TomuiTooltipSide = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "start" | "center" | "end";

/** Open/close transition states, driven by the disclosure state utilities. */
const STARTING = ":is([data-starting-style])";
const ENDING = ":is([data-ending-style])";
const INSTANT = ":is([data-instant])";

const styles = stylex.create({
  wrapper: {
    position: "relative",
    display: "inline-flex",
    cursor: "default",
  },
  popup: {
    position: "absolute",
    zIndex: 50,
    pointerEvents: "none",
    visibility: "visible",
    opacity: 1,
    display: "flex",
    flexDirection: "column",
    transformOrigin: "var(--transform-origin)",
    borderRadius: radius.md.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    paddingInline: "0.625rem",
    paddingBlock: "0.375rem",
    fontSize: fontSizeSm.fontSize,
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: colors["--color-tomui-line"],
    transitionProperty: "transform, scale, opacity",
    transitionDuration: "150ms",
    [STARTING]: { scale: 0.9, opacity: 0 },
    [ENDING]: { scale: 0.9, opacity: 0 },
    [INSTANT]: { transitionDuration: "0s" },
  },

  // Placement, one entry per side.
  sideTop: { bottom: "100%", left: "50%", marginBottom: "0.625rem", translate: "-50% 0" },
  sideBottom: { top: "100%", left: "50%", marginTop: "0.625rem", translate: "-50% 0" },
  sideLeft: { top: "50%", right: "100%", marginRight: "0.625rem", translate: "0 -50%" },
  sideRight: { top: "50%", left: "100%", marginLeft: "0.625rem", translate: "0 -50%" },
});

const sideStyles = {
  top: styles.sideTop,
  bottom: styles.sideBottom,
  left: styles.sideLeft,
  right: styles.sideRight,
} as const satisfies Record<TomuiTooltipSide, stylex.StyleXStyles>;

let globalWarmedUp = false;
let globalCoolDownTimeout: ReturnType<typeof setTimeout> | undefined;
let globalSkipDelayTimeout: ReturnType<typeof setTimeout> | undefined;
const openTooltips = new Map<string, () => void>();

export type TooltipProps = {
  align?: TooltipAlign;
  children?: JSX.Element;
  content: JSX.Element;
  ref?: HTMLSpanElement | ((element: HTMLSpanElement) => void) | undefined;
  side?: TomuiTooltipSide;
  openDelay?: number;
  closeDelay?: number;
  skipDelayDuration?: number;
  disabled?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
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
    "style",
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
      {...stylex.attrs(styles.wrapper, merged.style)}
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
          {...stylex.attrs(styles.popup, sideStyles[merged.side])}
        >
          {merged.content}
        </span>
      </Show>
    </span>
  );
}

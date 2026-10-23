import type { JSX } from "@solidjs/web";
import {
  createContext,
  createSignal,
  createUniqueId,
  merge,
  omit,
  Show,
  useContext,
} from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { createDismissableLayer } from "../../utils/dismissable";
import { createFocusScope, focusWithoutScrolling } from "../../utils/focus";
import { createDisclosureState } from "../../utils/state";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeSm } from "../../styles/typography.stylex";

export const TOMUI_POPOVER_DEFAULT_VARIANTS = {
  side: "bottom",
} as const;

export type TomuiPopoverSide = "top" | "bottom" | "left" | "right";
export type TomuiPopoverAlign = "start" | "center" | "end";

/** Open/close transition states, driven by the dismissable layer utilities. */
const STARTING = ":is([data-starting-style])";
const ENDING = ":is([data-ending-style])";
const INSTANT = ":is([data-instant])";

const styles = stylex.create({
  wrapper: { position: "relative" },
  content: {
    position: "absolute",
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    paddingInline: "1rem",
    paddingBlock: "0.75rem",
    fontSize: fontSizeSm.fontSize,
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    outlineWidth: 1,
    outlineStyle: "solid",
    outlineColor: colors["--color-tomui-line"],
    transitionProperty: "opacity",
    transitionDuration: "150ms",
    [STARTING]: { opacity: 0 },
    [ENDING]: { opacity: 0 },
    [INSTANT]: { transitionDuration: "0s" },
  },

  // Placement. The side prop drives which edge the panel sits against.
  sideTop: { insetBlockEnd: "100%", marginBlockEnd: "0.5rem" },
  sideBottom: { insetBlockStart: "100%", marginBlockStart: "0.5rem" },
  sideLeft: { insetInlineEnd: "100%", marginInlineEnd: "0.5rem" },
  sideRight: { insetInlineStart: "100%", marginInlineStart: "0.5rem" },

  title: {
    margin: 0,
    fontSize: fontSizeBase.fontSize,
    lineHeight: "1.5rem",
    fontWeight: 500,
  },
  description: {
    margin: 0,
    fontSize: fontSizeBase.fontSize,
    lineHeight: "1.5rem",
    color: textColors["--text-color-tomui-subtle"],
  },

  // In dark mode the offset goes inward, to line up with the inner arrow stroke.
  darkOutline: { "@media (prefers-color-scheme: dark)": { outlineOffset: "-1px" } },

  arrowFill: { fill: colors["--color-tomui-base"] },
  arrowEdge: { fill: colors["--color-tomui-arrow-edge"] },
  arrowStroke: { fill: colors["--color-tomui-arrow-stroke"] },
});

const sideStyles = {
  top: styles.sideTop,
  bottom: styles.sideBottom,
  left: styles.sideLeft,
  right: styles.sideRight,
} as const satisfies Record<TomuiPopoverSide, stylex.StyleXStyles>;

interface PopoverContextValue {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  contentId: string;
  triggerRef: () => HTMLElement | undefined;
  setTriggerRef: (el: HTMLElement | undefined) => void;
  contentRef: () => HTMLElement | undefined;
  setContentRef: (el: HTMLElement | undefined) => void;
}

const PopoverContext = createContext<PopoverContextValue>({
  isOpen: () => false,
  open: () => undefined,
  close: () => undefined,
  toggle: () => undefined,
  contentId: "",
  triggerRef: () => undefined,
  setTriggerRef: () => undefined,
  contentRef: () => undefined,
  setContentRef: () => undefined,
});

export type PopoverRootProps = {
  children?: JSX.Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function PopoverRoot(props: PopoverRootProps): JSX.Element {
  const state = createDisclosureState({
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    onOpenChange: props.onOpenChange,
  });
  const contentId = createUniqueId();
  const [triggerEl, setTriggerEl] = createSignal<HTMLElement>();
  const [contentEl, setContentEl] = createSignal<HTMLElement>();

  const value: PopoverContextValue = {
    isOpen: state.isOpen,
    open: state.open,
    close: state.close,
    toggle: state.toggle,
    contentId,
    triggerRef: () => triggerEl(),
    setTriggerRef: setTriggerEl,
    contentRef: () => contentEl(),
    setContentRef: setContentEl,
  };
  return <PopoverContext value={value}>{props.children}</PopoverContext>;
}

export type PopoverTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "style"
> & {
  children?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function PopoverTrigger(props: PopoverTriggerProps): JSX.Element {
  const ctx = useContext(PopoverContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "onClick", "style");
  return (
    <button
      data-tomui-component="Popover"
      data-tomui-part="trigger"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      aria-controls={ctx.isOpen() ? ctx.contentId : undefined}
      ref={(el: HTMLButtonElement) => ctx.setTriggerRef(el)}
      onClick={(event) => {
        ctx.toggle();
        merged.onClick?.(event);
      }}
      {...rest}
    >
      {merged.children}
    </button>
  );
}

export type PopoverContentProps = {
  children?: JSX.Element;
  side?: TomuiPopoverSide;
  align?: TomuiPopoverAlign;
  sideOffset?: number;
  alignOffset?: number;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function PopoverContent(props: PopoverContentProps): JSX.Element {
  const ctx = useContext(PopoverContext);
  const merged = merge(
    {
      side: TOMUI_POPOVER_DEFAULT_VARIANTS.side,
      align: "center" as const,
    },
    props,
  );
  const rest = omit(merged, "children", "style", "side", "align", "sideOffset", "alignOffset");

  createDismissableLayer(ctx.contentRef, {
    enabled: ctx.isOpen,
    excludedElements: [ctx.triggerRef],
    onDismiss: () => ctx.close(),
  });

  createFocusScope(ctx.contentRef, {
    enabled: ctx.isOpen,
    trapFocus: false,
    onMountAutoFocus: (e) => {
      e.preventDefault();
      const el = ctx.contentRef();
      if (el) focusWithoutScrolling(el);
    },
    onUnmountAutoFocus: (e) => {
      e.preventDefault();
      const trigger = ctx.triggerRef();
      if (trigger) focusWithoutScrolling(trigger);
    },
  });

  return (
    <Show when={ctx.isOpen()}>
      <div {...stylex.attrs(styles.wrapper)}>
        <div
          data-tomui-component="Popover"
          data-tomui-part="content"
          data-side={merged.side}
          data-align={merged.align}
          id={ctx.contentId}
          role="dialog"
          tabindex={-1}
          ref={(el: HTMLDivElement) => ctx.setContentRef(el)}
          {...stylex.attrs(
            styles.content,
            styles.darkOutline,
            sideStyles[merged.side],
            merged.style,
          )}
          {...rest}
        >
          {merged.children}
        </div>
      </div>
    </Show>
  );
}

export type PopoverTitleProps = Omit<JSX.HTMLAttributes<HTMLHeadingElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function PopoverTitle(props: PopoverTitleProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <h3
      data-tomui-component="Popover"
      data-tomui-part="title"
      {...stylex.attrs(styles.title, merged.style)}
      {...rest}
    >
      {merged.children}
    </h3>
  );
}

export type PopoverDescriptionProps = Omit<JSX.HTMLAttributes<HTMLParagraphElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function PopoverDescription(props: PopoverDescriptionProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <p
      data-tomui-component="Popover"
      data-tomui-part="description"
      {...stylex.attrs(styles.description, merged.style)}
      {...rest}
    >
      {merged.children}
    </p>
  );
}

export type PopoverCloseProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "style"
> & {
  children?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function PopoverClose(props: PopoverCloseProps): JSX.Element {
  const ctx = useContext(PopoverContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "onClick", "style");
  return (
    <button
      data-tomui-component="Popover"
      data-tomui-part="close"
      aria-label="Close"
      onClick={(event) => {
        ctx.close();
        merged.onClick?.(event);
      }}
      {...rest}
    >
      {merged.children}
    </button>
  );
}

function ArrowSvg(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  const { style: _ignored, ...rest } = props;
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...rest}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        {...stylex.attrs(styles.arrowFill)}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        {...stylex.attrs(styles.arrowEdge)}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        {...stylex.attrs(styles.arrowStroke)}
      />
    </svg>
  );
}

export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: PopoverClose,
  Arrow: ArrowSvg,
});

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
import { cn } from "../../utils/cn";
import { createDismissableLayer } from "../../utils/dismissable";
import { createFocusScope, focusWithoutScrolling } from "../../utils/focus";
import { createDisclosureState } from "../../utils/state";

export const TOMUI_POPOVER_VARIANTS = {
  side: {
    top: { classes: "", description: "Popover appears above the trigger" },
    bottom: { classes: "", description: "Popover appears below the trigger" },
    left: { classes: "", description: "Popover appears to the left of the trigger" },
    right: { classes: "", description: "Popover appears to the right of the trigger" },
  },
} as const;

export const TOMUI_POPOVER_DEFAULT_VARIANTS = {
  side: "bottom",
} as const;

export type TomuiPopoverSide = keyof typeof TOMUI_POPOVER_VARIANTS.side;

export interface TomuiPopoverVariantsProps {
  side?: TomuiPopoverSide;
}

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

export type PopoverTriggerProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children?: JSX.Element;
  class?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

export function PopoverTrigger(props: PopoverTriggerProps): JSX.Element {
  const ctx = useContext(PopoverContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "onClick");
  return (
    <button
      data-tomui-component="Popover"
      data-tomui-part="trigger"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      aria-controls={ctx.isOpen() ? ctx.contentId : undefined}
      class={merged.class}
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

export type PopoverContentProps = TomuiPopoverVariantsProps & {
  children?: JSX.Element;
  class?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
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
  const rest = omit(merged, "children", "class", "side", "align", "sideOffset", "alignOffset");

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
      <div class="relative">
        <div
          {...rest}
          id={ctx.contentId}
          data-tomui-component="Popover"
          data-tomui-part="content"
          data-side={merged.side}
          data-align={merged.align}
          role="dialog"
          tabindex={-1}
          class={cn(
            "absolute z-50 flex flex-col rounded-lg bg-tomui-base px-4 py-3 text-sm text-tomui-default",
            "shadow-md outline outline-tomui-line",
            "transition-opacity duration-150",
            "data-starting-style:opacity-0",
            "data-ending-style:opacity-0",
            "data-instant:duration-0",
            "tomui-popover-popup",
            merged.side === "top" && "bottom-full mb-2",
            merged.side === "bottom" && "top-full mt-2",
            merged.side === "left" && "right-full mr-2",
            merged.side === "right" && "left-full ml-2",
            merged.class,
          )}
          ref={(el: HTMLDivElement) => ctx.setContentRef(el)}
        >
          {merged.children}
        </div>
      </div>
    </Show>
  );
}

export type PopoverTitleProps = JSX.HTMLAttributes<HTMLHeadingElement> & {
  children?: JSX.Element;
  class?: string;
};

export function PopoverTitle(props: PopoverTitleProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <h3
      data-tomui-component="Popover"
      data-tomui-part="title"
      class={cn("m-0 text-base leading-6 font-medium", merged.class)}
      {...rest}
    >
      {merged.children}
    </h3>
  );
}

export type PopoverDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement> & {
  children?: JSX.Element;
  class?: string;
};

export function PopoverDescription(props: PopoverDescriptionProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <p
      data-tomui-component="Popover"
      data-tomui-part="description"
      class={cn("m-0 text-base leading-6 text-tomui-subtle", merged.class)}
      {...rest}
    >
      {merged.children}
    </p>
  );
}

export type PopoverCloseProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children?: JSX.Element;
  class?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

export function PopoverClose(props: PopoverCloseProps): JSX.Element {
  const ctx = useContext(PopoverContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "onClick");
  return (
    <button
      data-tomui-component="Popover"
      data-tomui-part="close"
      aria-label="Close"
      class={merged.class}
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
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        class="fill-tomui-base"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        class="fill-tomui-arrow-edge"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        class="fill-tomui-arrow-stroke"
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

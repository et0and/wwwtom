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
import { createFocusScope, createHideOutside, createPreventScroll } from "../../utils/focus";
import { createDisclosureState } from "../../utils/state";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_DIALOG_DEFAULT_VARIANTS = {
  size: "base",
  role: "dialog",
} as const;

export type TomuiDialogSize = "sm" | "base" | "lg" | "xl";
export type TomuiDialogRole = "dialog" | "alertdialog";

/**
 * Which responsive layout the panel uses.
 * - `"panel"` — centred, capped width. The default.
 * - `"full"` — full-viewport, square corners. For embedded viewers such as a
 *   PDF that need the whole screen.
 *
 * StyleX emits media-query rules that a caller's plain style cannot outrank, so
 * a caller that needs to own the responsive layout picks `full` rather than
 * overriding `top` and friends with `!important`.
 */
export type TomuiDialogSurface = "panel" | "full";

/** Open/close transition states, driven by the dismissable layer utilities. */
const OPEN = ":is([data-starting-style])";
const CLOSING = ":is([data-ending-style])";

const styles = stylex.create({
  overlay: { position: "fixed", inset: 0, zIndex: 50 },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: textColors["--text-color-tomui-default"],
    opacity: 0.8,
    transitionDuration: "150ms",
    transitionProperty: "opacity",
    [OPEN]: { opacity: 0 },
    [CLOSING]: { opacity: 0 },
  },
  content: {
    position: "fixed",
    insetBlockStart: "2rem",
    insetInlineStart: "50%",
    width: "100%",
    maxWidth: "calc(100vw - 2rem)",
    transform: "translateX(-50%)",
    overflow: "hidden",
    borderRadius: "0.75rem",
    backgroundColor: textColors["--text-color-tomui-default"],
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 0 0 1px " + textColors["--text-color-tomui-default"],
    transitionDuration: "150ms",
    "@media (min-width: 640px)": { insetBlockStart: "4rem" },
    [OPEN]: { transform: "translateX(-50%) scale(0.9)", opacity: 0 },
    [CLOSING]: { transform: "translateX(-50%) scale(0.9)", opacity: 0 },
  },

  // Widths apply from the small breakpoint up, matching the old sm: prefix.
  // StyleX types a media-query key as its own variant, so the width lives on the
  // same style object as the rest rather than in a separate size style.
  sizeSm: { width: "100%", "@media (min-width: 640px)": { width: "18rem" } },
  sizeBase: { width: "100%", "@media (min-width: 640px)": { width: "24rem" } },
  sizeLg: { width: "100%", "@media (min-width: 640px)": { width: "32rem" } },
  sizeXl: { width: "100%", "@media (min-width: 640px)": { width: "48rem" } },

  // Full-viewport surface: owns every responsive rule itself, so nothing here
  // needs overriding from the caller.
  full: {
    position: "fixed",
    insetBlockStart: 0,
    insetInlineStart: 0,
    width: "100%",
    height: "100dvh",
    maxWidth: "none",
    transform: "none",
    borderRadius: 0,
    "@media (min-width: 640px)": {
      insetBlockStart: "4rem",
      insetInlineStart: "50%",
      height: "80dvh",
      maxWidth: "calc(100vw - 2rem)",
      transform: "translateX(-50%)",
    },
  },
});

// The media-query widths are not assignable to StyleXStyles, so this map keeps
// its inferred type rather than widening to a StyleX one.
const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
} as const;

interface DialogContextValue {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  role: () => TomuiDialogRole;
  titleId: string;
  descriptionId: string;
  contentId: string;
  triggerRef: () => HTMLElement | undefined;
  setTriggerRef: (el: HTMLElement | undefined) => void;
  contentRef: () => HTMLElement | undefined;
  setContentRef: (el: HTMLElement | undefined) => void;
}

const DialogContext = createContext<DialogContextValue>({
  isOpen: () => false,
  open: () => undefined,
  close: () => undefined,
  toggle: () => undefined,
  role: () => "dialog",
  titleId: "",
  descriptionId: "",
  contentId: "",
  triggerRef: () => undefined,
  setTriggerRef: () => undefined,
  contentRef: () => undefined,
  setContentRef: () => undefined,
});

export type DialogRootProps = {
  children?: JSX.Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  role?: TomuiDialogRole;
};

export function DialogRoot(props: DialogRootProps): JSX.Element {
  const merged = merge({ role: TOMUI_DIALOG_DEFAULT_VARIANTS.role }, props);
  const state = createDisclosureState({
    open: () => merged.open,
    defaultOpen: merged.defaultOpen,
    onOpenChange: merged.onOpenChange,
  });

  const baseId = createUniqueId();
  const [triggerEl, setTriggerEl] = createSignal<HTMLElement>();
  const [contentEl, setContentEl] = createSignal<HTMLElement>();

  const value: DialogContextValue = {
    isOpen: state.isOpen,
    open: state.open,
    close: state.close,
    toggle: state.toggle,
    role: () => merged.role,
    titleId: `${baseId}-title`,
    descriptionId: `${baseId}-description`,
    contentId: `${baseId}-content`,
    triggerRef: () => triggerEl(),
    setTriggerRef: setTriggerEl,
    contentRef: () => contentEl(),
    setContentRef: setContentEl,
  };

  return <DialogContext value={value}>{merged.children}</DialogContext>;
}

export type DialogTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "style"
> & {
  children?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DialogTrigger(props: DialogTriggerProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "onClick", "style");
  return (
    <button
      data-tomui-component="Dialog"
      data-tomui-part="trigger"
      aria-haspopup="dialog"
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

export type DialogProps = {
  children?: JSX.Element;
  size?: TomuiDialogSize;
  /** Responsive layout. Defaults to the centred panel. */
  surface?: TomuiDialogSurface;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DialogContent(props: DialogProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({ size: TOMUI_DIALOG_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "children", "style", "size", "surface");
  const closeOnBackdrop = (): boolean => ctx.role() === "dialog";

  createDismissableLayer(ctx.contentRef, {
    enabled: ctx.isOpen,
    excludedElements: [ctx.triggerRef],
    onDismiss: () => ctx.close(),
  });

  createFocusScope(ctx.contentRef, {
    enabled: ctx.isOpen,
    trapFocus: true,
    onMountAutoFocus: (e) => {
      e.preventDefault();
      const el = ctx.contentRef();
      if (el) el.focus();
    },
    onUnmountAutoFocus: (e) => {
      e.preventDefault();
      const trigger = ctx.triggerRef();
      if (trigger) trigger.focus();
    },
  });

  createHideOutside({
    enabled: ctx.isOpen,
    targets: () => [ctx.contentRef()],
  });

  createPreventScroll(ctx.isOpen);

  return (
    <Show when={ctx.isOpen()}>
      <div {...stylex.attrs(styles.overlay)}>
        <div
          data-tomui-component="Dialog"
          data-tomui-part="backdrop"
          {...stylex.attrs(styles.backdrop)}
          onClick={() => {
            if (closeOnBackdrop()) ctx.close();
          }}
        />
        <div
          data-tomui-component="Dialog"
          id={ctx.contentId}
          role={ctx.role()}
          aria-modal="true"
          aria-labelledby={ctx.titleId}
          aria-describedby={ctx.descriptionId}
          tabindex={-1}
          ref={(el: HTMLDivElement) => ctx.setContentRef(el)}
          {...stylex.attrs(
            styles.content,
            merged.surface === "full" ? styles.full : sizeStyles[merged.size],
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

export type DialogTitleProps = Omit<JSX.HTMLAttributes<HTMLHeadingElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DialogTitle(props: DialogTitleProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <h2 data-tomui-component="Dialog" data-tomui-part="title" id={ctx.titleId} {...rest}>
      {merged.children}
    </h2>
  );
}

export type DialogDescriptionProps = Omit<JSX.HTMLAttributes<HTMLParagraphElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DialogDescription(props: DialogDescriptionProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <p data-tomui-component="Dialog" data-tomui-part="description" id={ctx.descriptionId} {...rest}>
      {merged.children}
    </p>
  );
}

export type DialogCloseProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "style"
> & {
  children?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DialogClose(props: DialogCloseProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "onClick", "style");
  return (
    <button
      data-tomui-component="Dialog"
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

export const Dialog = Object.assign(DialogContent, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});

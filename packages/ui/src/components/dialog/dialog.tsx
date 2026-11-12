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
import { XIcon } from "@tom/icons/X";
import { Button, type MidoriButtonSize, type MidoriButtonVariant } from "../button/button";
import { createDismissableLayer } from "../../utils/dismissable";
import { createFocusScope, createHideOutside, createPreventScroll } from "../../utils/focus";
import { createDisclosureState } from "../../utils/state";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSizeMd, fontSizeSm, fontWeightControl } from "../../styles/typography.stylex";

export const MIDORI_DIALOG_DEFAULT_VARIANTS = {
  size: "base",
  role: "dialog",
} as const;

export type MidoriDialogSize = "sm" | "base" | "lg" | "xl";
export type MidoriDialogRole = "dialog" | "alertdialog";

/**
 * Which layout the panel uses.
 * - `"panel"` — centred, capped width. The default.
 * - `"full"` — full-viewport, square corners. For embedded viewers such as a
 *   PDF that need the whole screen.
 */
export type MidoriDialogSurface = "panel" | "full";

/** Open/close transition states, driven by the dismissable layer utilities. */
const OPEN = ":is([data-starting-style])";
const CLOSING = ":is([data-ending-style])";

const styles = stylex.create({
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: colors["--color-midori-overlay-scrim"],
    transitionDuration: "150ms",
    transitionProperty: "opacity",
    [OPEN]: { opacity: 0 },
    [CLOSING]: { opacity: 0 },
  },
  content: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    width: "100%",
    maxWidth: "calc(100vw - 2rem)",
    maxHeight: "calc(100dvh - 2rem)",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors["--color-midori-layer-01"],
    color: textColors["--text-color-midori-default"],
    boxShadow: elevation["--elevation-midori-overlay"],
    outlineWidth: 0,
    outlineStyle: "none",
    transitionDuration: "120ms",
    transitionProperty: "opacity, scale",
    [OPEN]: { opacity: 0, scale: 0.96 },
    [CLOSING]: { opacity: 0, scale: 0.96 },
  },
  sizeSm: { maxWidth: "24rem" },
  sizeBase: { maxWidth: "30rem" },
  sizeLg: { maxWidth: "40rem" },
  sizeXl: { maxWidth: "min(calc(100vw - 2rem), 61.25rem)" },
  full: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100dvh",
    maxWidth: "none",
    maxHeight: "none",
    borderRadius: 0,
  },
  header: {
    display: "flex",
    width: "100%",
    flexShrink: 0,
    alignItems: "flex-start",
    gap: "0.5rem",
    padding: "1rem",
  },
  titleGroup: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: "0.25rem",
  },
  title: {
    margin: 0,
    fontSize: fontSizeMd.fontSize,
    lineHeight: fontSizeMd.lineHeight,
    fontWeight: fontWeightControl.fontWeight,
    color: textColors["--text-color-midori-default"],
  },
  description: {
    margin: 0,
    fontSize: fontSizeSm.fontSize,
    fontWeight: 440,
    lineHeight: "20px",
    color: textColors["--text-color-midori-subtle"],
  },
  close: {
    display: "flex",
    width: "1.25rem",
    height: "1.25rem",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "-0.125rem",
    marginInlineEnd: "-0.125rem",
    marginInlineStart: "auto",
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: "transparent",
    color: textColors["--text-color-midori-subtle"],
    cursor: "pointer",
    ":hover": {
      backgroundColor: colors["--color-midori-overlay-hover"],
      color: textColors["--text-color-midori-default"],
    },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors["--color-midori-focus"],
      outlineOffset: "1px",
    },
  },
  body: {
    width: "100%",
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    paddingInline: "1rem",
    paddingBlockEnd: "1rem",
  },
  footer: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.5rem",
    padding: "1rem",
  },
});

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
  role: () => MidoriDialogRole;
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
  role?: MidoriDialogRole;
};

export function DialogRoot(props: DialogRootProps): JSX.Element {
  const merged = merge({ role: MIDORI_DIALOG_DEFAULT_VARIANTS.role }, props);
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
      data-midori-component="Dialog"
      data-midori-part="trigger"
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
  size?: MidoriDialogSize;
  /** Responsive layout. Defaults to the centred panel. */
  surface?: MidoriDialogSurface;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DialogContent(props: DialogProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({ size: MIDORI_DIALOG_DEFAULT_VARIANTS.size }, props);
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
          data-midori-component="Dialog"
          data-midori-part="backdrop"
          {...stylex.attrs(styles.backdrop)}
          onClick={() => {
            if (closeOnBackdrop()) ctx.close();
          }}
        />
        <div
          data-midori-component="Dialog"
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
    <h2
      data-midori-component="Dialog"
      data-midori-part="title"
      id={ctx.titleId}
      {...stylex.attrs(styles.title, merged.style)}
      {...rest}
    >
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
    <p
      data-midori-component="Dialog"
      data-midori-part="description"
      id={ctx.descriptionId}
      {...stylex.attrs(styles.description, merged.style)}
      {...rest}
    >
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
  /** Render a full button instead of the header's icon-sized close control. */
  variant?: MidoriButtonVariant | undefined;
  size?: MidoriButtonSize | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DialogClose(props: DialogCloseProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(
    merged,
    "children",
    "onClick",
    "style",
    "variant",
    "size",
    "form",
    "title",
    "type",
  );
  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
    ctx.close();
    merged.onClick?.(event);
  };
  return (
    <Show
      when={merged.variant}
      fallback={
        <button
          data-midori-component="Dialog"
          data-midori-part="close"
          {...stylex.attrs(styles.close, merged.style)}
          onClick={handleClick}
          {...rest}
          aria-label={merged["aria-label"] ?? "Close"}
        >
          <Show when={merged.children} fallback={<XIcon size="sm" color="current" />}>
            {(children) => children()}
          </Show>
        </button>
      }
    >
      {(variant) => (
        <Button
          data-midori-component="Dialog"
          data-midori-part="close"
          variant={variant()}
          size={merged.size ?? "base"}
          style={merged.style}
          onClick={handleClick}
          {...rest}
        >
          {merged.children}
        </Button>
      )}
    </Show>
  );
}

export type DialogHeaderProps = {
  children?: JSX.Element;
  closeLabel?: string;
  hideClose?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DialogHeader(props: DialogHeaderProps): JSX.Element {
  const merged = merge({ hideClose: false }, props);
  return (
    <div data-midori-part="header" {...stylex.attrs(styles.header, merged.style)}>
      {merged.children}
      <Show when={!merged.hideClose}>
        <DialogClose aria-label={merged.closeLabel} />
      </Show>
    </div>
  );
}

export type DialogTitleGroupProps = {
  title?: JSX.Element;
  description?: JSX.Element;
};

function DialogTitleGroup(props: DialogTitleGroupProps): JSX.Element {
  return (
    <div data-midori-part="title-group" {...stylex.attrs(styles.titleGroup)}>
      <Show when={props.title}>{(title) => <DialogTitle>{title()}</DialogTitle>}</Show>
      <Show when={props.description}>
        {(description) => <DialogDescription>{description()}</DialogDescription>}
      </Show>
    </div>
  );
}

export type DialogSectionProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DialogBody(props: DialogSectionProps): JSX.Element {
  return (
    <div data-midori-part="body" {...stylex.attrs(styles.body, props.style)}>
      {props.children}
    </div>
  );
}

function DialogFooter(props: DialogSectionProps): JSX.Element {
  return (
    <div data-midori-part="footer" {...stylex.attrs(styles.footer, props.style)}>
      {props.children}
    </div>
  );
}

export const Dialog = Object.assign(DialogContent, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Header: DialogHeader,
  TitleGroup: DialogTitleGroup,
  Title: DialogTitle,
  Description: DialogDescription,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: DialogClose,
});

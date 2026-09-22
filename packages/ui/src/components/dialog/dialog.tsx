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
import { resolveVariant } from "../../utils/resolve-variant";
import { createDismissableLayer } from "../../utils/dismissable";
import { createFocusScope, createHideOutside, createPreventScroll } from "../../utils/focus";
import { createDisclosureState } from "../../utils/state";

export const TOMUI_DIALOG_VARIANTS = {
  size: {
    base: {
      classes: "sm:w-96",
      description: "Default dialog width (384px)",
    },
    sm: {
      classes: "sm:w-72",
      description: "Small dialog for simple confirmations (288px)",
    },
    lg: {
      classes: "sm:w-[32rem]",
      description: "Large dialog for complex content (512px)",
    },
    xl: {
      classes: "sm:w-[48rem]",
      description: "Extra large dialog for detailed views (768px)",
    },
  },
  role: {
    dialog: {
      classes: "",
      description: "Standard dialog for general-purpose modals",
    },
    alertdialog: {
      classes: "",
      description: "Alert dialog for confirmation flows requiring explicit user acknowledgment",
    },
  },
} as const;

export const TOMUI_DIALOG_DEFAULT_VARIANTS = {
  size: "base",
  role: "dialog",
} as const;

export type TomuiDialogSize = keyof typeof TOMUI_DIALOG_VARIANTS.size;
export type TomuiDialogRole = keyof typeof TOMUI_DIALOG_VARIANTS.role;

export interface TomuiDialogVariantsProps {
  size?: TomuiDialogSize;
}

export function dialogVariants(props: TomuiDialogVariantsProps = {}): string {
  const merged = merge({ size: TOMUI_DIALOG_DEFAULT_VARIANTS.size }, props);
  return cn(
    "shadow-m ring ring-tomui-line fixed top-8 left-1/2 sm:top-16 w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl bg-tomui-base text-tomui-default duration-150 data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0",
    resolveVariant(TOMUI_DIALOG_VARIANTS.size, merged.size, TOMUI_DIALOG_DEFAULT_VARIANTS.size)
      .classes,
  );
}

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

export type DialogTriggerProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children?: JSX.Element;
  class?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

export function DialogTrigger(props: DialogTriggerProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "onClick");
  return (
    <button
      data-tomui-component="Dialog"
      data-tomui-part="trigger"
      aria-haspopup="dialog"
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

export type DialogProps = TomuiDialogVariantsProps & {
  children?: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
};

function DialogContent(props: DialogProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({ size: TOMUI_DIALOG_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "children", "class", "style", "size");
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
      <div class="fixed inset-0 z-50">
        <div
          data-tomui-component="Dialog"
          data-tomui-part="backdrop"
          class="fixed inset-0 bg-tomui-recessed opacity-80 transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
          onClick={() => {
            if (closeOnBackdrop()) ctx.close();
          }}
        />
        <div
          {...rest}
          data-tomui-component="Dialog"
          id={ctx.contentId}
          role={ctx.role()}
          aria-modal="true"
          aria-labelledby={ctx.titleId}
          aria-describedby={ctx.descriptionId}
          tabindex={-1}
          class={cn(dialogVariants({ size: merged.size }), merged.class)}
          style={merged.style}
          ref={(el: HTMLDivElement) => ctx.setContentRef(el)}
        >
          {merged.children}
        </div>
      </div>
    </Show>
  );
}

export type DialogTitleProps = JSX.HTMLAttributes<HTMLHeadingElement> & {
  children?: JSX.Element;
  class?: string;
};

export function DialogTitle(props: DialogTitleProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <h2
      data-tomui-component="Dialog"
      data-tomui-part="title"
      id={ctx.titleId}
      class={merged.class}
      {...rest}
    >
      {merged.children}
    </h2>
  );
}

export type DialogDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement> & {
  children?: JSX.Element;
  class?: string;
};

export function DialogDescription(props: DialogDescriptionProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <p
      data-tomui-component="Dialog"
      data-tomui-part="description"
      id={ctx.descriptionId}
      class={merged.class}
      {...rest}
    >
      {merged.children}
    </p>
  );
}

export type DialogCloseProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children?: JSX.Element;
  class?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

export function DialogClose(props: DialogCloseProps): JSX.Element {
  const ctx = useContext(DialogContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "onClick");
  return (
    <button
      data-tomui-component="Dialog"
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

export const Dialog = Object.assign(DialogContent, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});

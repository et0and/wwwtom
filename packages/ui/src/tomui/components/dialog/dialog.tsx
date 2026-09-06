import type { JSX } from "@solidjs/web";
import { createContext, createSignal, merge, Show, omit, useContext } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

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
    "shadow-m ring ring-tomui-line fixed top-8 left-1/2 sm:top-16 w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl bg-tomui-base text-tomui-default",
    resolveVariant(TOMUI_DIALOG_VARIANTS.size, merged.size, TOMUI_DIALOG_DEFAULT_VARIANTS.size)
      .classes,
  );
}

interface DialogContextValue {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  role: () => TomuiDialogRole;
}

const DialogContext = createContext<DialogContextValue>({
  isOpen: () => false,
  open: () => undefined,
  close: () => undefined,
  role: () => "dialog",
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
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(merged.defaultOpen ?? false);
  const isOpen = (): boolean => merged.open ?? uncontrolledOpen();
  const setOpen = (next: boolean): void => {
    if (merged.open === undefined) setUncontrolledOpen(next);
    merged.onOpenChange?.(next);
  };
  const value: DialogContextValue = {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    role: () => merged.role,
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
      class={merged.class}
      onClick={(event) => {
        ctx.open();
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
  return (
    <Show when={ctx.isOpen()}>
      <div class="fixed inset-0 z-50">
        <div
          data-tomui-component="Dialog"
          data-tomui-part="backdrop"
          class="fixed inset-0 bg-tomui-recessed opacity-80"
          onClick={() => {
            if (closeOnBackdrop()) ctx.close();
          }}
        />
        <div
          {...rest}
          data-tomui-component="Dialog"
          role={ctx.role()}
          aria-modal="true"
          class={cn(dialogVariants({ size: merged.size }), merged.class)}
          style={merged.style}
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
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <h2 data-tomui-component="Dialog" data-tomui-part="title" class={merged.class} {...rest}>
      {merged.children}
    </h2>
  );
}

export type DialogDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement> & {
  children?: JSX.Element;
  class?: string;
};

export function DialogDescription(props: DialogDescriptionProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <p data-tomui-component="Dialog" data-tomui-part="description" class={merged.class} {...rest}>
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

import { createSignal, createUniqueId, For, merge, omit, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_TOAST_VARIANTS = {
  variant: {
    default: { classes: "border-tomui-fill bg-tomui-base", description: "Default toast style" },
    success: {
      classes:
        "ring-[0.3px] ring-tomui-success bg-tomui-base [&_[data-toast-icon]]:text-tomui-success [&_[data-toast-title]]:text-tomui-success",
      description: "Success toast for confirmations and positive outcomes",
    },
    error: {
      classes:
        "ring-[0.3px] ring-tomui-danger bg-tomui-base [&_[data-toast-icon]]:text-tomui-danger [&_[data-toast-title]]:text-tomui-danger",
      description: "Error toast for critical issues",
    },
    warning: {
      classes:
        "ring-[0.3px] ring-tomui-warning bg-tomui-base [&_[data-toast-icon]]:text-tomui-warning [&_[data-toast-title]]:text-tomui-warning",
      description: "Warning toast for cautionary messages",
    },
    info: {
      classes:
        "ring-[0.3px] ring-tomui-info bg-tomui-control [&_[data-toast-icon]]:text-tomui-info [&_[data-toast-title]]:text-tomui-info",
      description: "Info toast for neutral informational messages",
    },
  },
} as const;

export const TOMUI_TOAST_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type TomuiToastVariant = keyof typeof TOMUI_TOAST_VARIANTS.variant;

export function toastVariants(props: { variant?: TomuiToastVariant } = {}): string {
  const merged = merge(TOMUI_TOAST_DEFAULT_VARIANTS, props);
  return cn(
    "rounded-xl ring ring-tomui-line bg-clip-padding p-4 shadow-lg",
    resolveVariant(
      TOMUI_TOAST_VARIANTS.variant,
      merged.variant,
      TOMUI_TOAST_DEFAULT_VARIANTS.variant,
    ).classes,
  );
}

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: TomuiToastVariant;
  duration?: number;
};

export type ToastOptions = Omit<ToastItem, "id">;

export function createToastStore() {
  const [toasts, setToasts] = createSignal<ReadonlyArray<ToastItem>>([]);
  const dismiss = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };
  const notify = (options: ToastOptions): string => {
    const id = createUniqueId();
    const item: ToastItem = { ...options, id };
    setToasts((current) => [...current, item]);
    const duration = options.duration ?? 4000;
    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      onCleanup(() => clearTimeout(timer));
    }
    return id;
  };
  return { toasts, notify, dismiss };
}

export type ToasterProps = JSX.HTMLAttributes<HTMLDivElement> & {
  class?: string | undefined;
  toasts?: ReadonlyArray<ToastItem> | undefined;
  onDismiss?: ((id: string) => void) | undefined;
};

export function Toaster(props: ToasterProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "toasts", "onDismiss");
  const items = () => merged.toasts ?? [];
  return (
    <div
      data-tomui-component="Toaster"
      aria-live="polite"
      class={cn("fixed bottom-4 right-4 z-50 flex w-[300px] flex-col gap-2", merged.class)}
      {...rest}
    >
      <For each={items()}>
        {(toast) => (
          <div
            role="status"
            class={toastVariants({
              variant: toast.variant ?? TOMUI_TOAST_DEFAULT_VARIANTS.variant,
            })}
          >
            <div class="flex items-start gap-2">
              <div class="flex min-w-0 flex-col gap-1">
                <p
                  data-toast-title
                  class="text-[0.975rem] leading-5 font-medium text-tomui-default"
                >
                  {toast.title}
                </p>
                <Show when={toast.description}>
                  <p class="text-[0.925rem] leading-5 text-tomui-subtle">{toast.description}</p>
                </Show>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                class="ml-auto size-5 shrink-0 rounded text-tomui-subtle hover:bg-current/15"
                onClick={() => merged.onDismiss?.(toast.id)}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </For>
      {merged.children}
    </div>
  );
}

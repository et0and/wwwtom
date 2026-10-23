import * as stylex from "@stylexjs/stylex";
import { createSignal, For, merge, omit, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { XIcon } from "@tom/icons/X";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";

/** Tailwind's `sm:` breakpoint, used by the toaster's responsive placement. */
const SM = "@media (min-width: 640px)";

/** Matches Tailwind's default `shadow-lg` utility. */
const SHADOW_LG = "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";

const lineColor = colors["--color-tomui-line"];
const fillColor = colors["--color-tomui-fill"];
const baseColor = colors["--color-tomui-base"];
const controlColor = colors["--color-tomui-control"];
const successColor = colors["--color-tomui-success"];
const dangerColor = colors["--color-tomui-danger"];
const warningColor = colors["--color-tomui-warning"];
const infoColor = colors["--color-tomui-info"];

const defaultText = textColors["--text-color-tomui-default"];
const subtleText = textColors["--text-color-tomui-subtle"];
const successText = textColors["--text-color-tomui-success"];
const dangerText = textColors["--text-color-tomui-danger"];
const warningText = textColors["--text-color-tomui-warning"];
const infoText = textColors["--text-color-tomui-info"];

const styles = stylex.create({
  toasterRoot: {
    position: "fixed",
    insetBlockEnd: "1rem",
    insetInlineEnd: "1rem",
    zIndex: 1,
    display: "flex",
    width: "calc(100% - 2rem)",
    flexDirection: "column",
    gap: "0.5rem",
    [SM]: { insetBlockEnd: "2rem", insetInlineEnd: "2rem", width: "340px" },
  },
  toastShell: {
    position: "relative",
    borderRadius: "0.75rem",
    backgroundClip: "padding-box",
    padding: "1rem",
  },
  toastDefault: {
    borderWidth: 1,
    borderColor: fillColor,
    backgroundColor: baseColor,
    boxShadow: "0 0 0 1px " + lineColor + ", " + SHADOW_LG,
  },
  toastSuccess: {
    backgroundColor: baseColor,
    boxShadow: "0 0 0 0.3px " + successColor + ", " + SHADOW_LG,
  },
  toastError: {
    backgroundColor: baseColor,
    boxShadow: "0 0 0 0.3px " + dangerColor + ", " + SHADOW_LG,
  },
  toastWarning: {
    backgroundColor: baseColor,
    boxShadow: "0 0 0 0.3px " + warningColor + ", " + SHADOW_LG,
  },
  toastInfo: {
    backgroundColor: controlColor,
    boxShadow: "0 0 0 0.3px " + infoColor + ", " + SHADOW_LG,
  },
  body: { display: "flex", alignItems: "flex-start", gap: "0.5rem" },
  textColumn: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: "0.25rem",
    overflow: "hidden",
  },
  title: { fontSize: "0.975rem", lineHeight: "1.25rem", fontWeight: 500, color: defaultText },
  titleSuccess: { color: successText },
  titleError: { color: dangerText },
  titleWarning: { color: warningText },
  titleInfo: { color: infoText },
  description: {
    fontSize: "0.925rem",
    lineHeight: "1.25rem",
    color: "color-mix(in oklch, " + defaultText + " 70%, transparent)",
  },
  close: {
    position: "absolute",
    top: "0.5rem",
    right: "0.5rem",
    display: "flex",
    height: "1.25rem",
    width: "1.25rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.25rem",
    color: subtleText,
    ":hover": { backgroundColor: "color-mix(in srgb, currentColor 15%, transparent)" },
  },
  closeSuccess: { color: successText },
  closeError: { color: dangerText },
  closeWarning: { color: warningText },
  closeInfo: { color: infoText },
});

export const TOMUI_TOAST_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type TomuiToastVariant = "default" | "success" | "error" | "warning" | "info";

const toastVariantStyles = {
  default: styles.toastDefault,
  success: styles.toastSuccess,
  error: styles.toastError,
  warning: styles.toastWarning,
  info: styles.toastInfo,
} as const satisfies Record<TomuiToastVariant, stylex.StyleXStyles>;

const titleVariantStyles = {
  default: undefined,
  success: styles.titleSuccess,
  error: styles.titleError,
  warning: styles.titleWarning,
  info: styles.titleInfo,
} as const satisfies Record<TomuiToastVariant, stylex.StyleXStyles | undefined>;

const closeVariantStyles = {
  default: undefined,
  success: styles.closeSuccess,
  error: styles.closeError,
  warning: styles.closeWarning,
  info: styles.closeInfo,
} as const satisfies Record<TomuiToastVariant, stylex.StyleXStyles | undefined>;

export function toastVariants(
  props: { variant?: TomuiToastVariant } = {},
): Array<stylex.StyleXStyles> {
  const merged = merge(TOMUI_TOAST_DEFAULT_VARIANTS, props);
  return [styles.toastShell, toastVariantStyles[merged.variant]];
}

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: TomuiToastVariant;
  duration?: number;
};

export type ToastOptions = Omit<ToastItem, "id">;

let toastCounter = 0;

export interface ToastStore {
  toasts: () => ReadonlyArray<ToastItem>;
  notify: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export function createToastStore(): ToastStore {
  const [toasts, setToasts] = createSignal<ReadonlyArray<ToastItem>>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const dismiss = (id: string) => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const notify = (options: ToastOptions): string => {
    toastCounter += 1;
    const id = `toast-${toastCounter}`;
    const item: ToastItem = { ...options, id };
    setToasts((current) => [...current, item]);
    const duration = options.duration ?? 4000;
    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timers.set(id, timer);
    }
    return id;
  };

  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });

  return { toasts, notify, dismiss };
}

export type ToasterProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  toasts?: ReadonlyArray<ToastItem> | undefined;
  onDismiss?: ((id: string) => void) | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles | undefined;
};

export function Toaster(props: ToasterProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style", "toasts", "onDismiss");
  const items = () => merged.toasts ?? [];
  return (
    <div
      data-tomui-component="Toaster"
      data-tomui-top-layer
      aria-live="polite"
      {...stylex.attrs(styles.toasterRoot, merged.style)}
      {...rest}
    >
      <For each={items()}>
        {(toast) => {
          const variant = toast.variant ?? TOMUI_TOAST_DEFAULT_VARIANTS.variant;
          return (
            <div role="status" {...stylex.attrs(...toastVariants({ variant }))}>
              <div {...stylex.attrs(styles.body)}>
                <div {...stylex.attrs(styles.textColumn)}>
                  <p data-toast-title {...stylex.attrs(styles.title, titleVariantStyles[variant])}>
                    {toast.title}
                  </p>
                  <Show when={toast.description}>
                    <p {...stylex.attrs(styles.description)}>{toast.description}</p>
                  </Show>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  {...stylex.attrs(styles.close, closeVariantStyles[variant])}
                  onClick={() => merged.onDismiss?.(toast.id)}
                >
                  <XIcon size="sm" />
                </button>
              </div>
            </div>
          );
        }}
      </For>
      {merged.children}
    </div>
  );
}

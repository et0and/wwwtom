import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { Loader } from "../loader/loader";

export const TOMUI_BUTTON_VARIANTS = {
  form: {
    base: { classes: "", description: "Default rectangular button form" },
    square: {
      classes: "items-center justify-center p-0",
      description: "Square button for icon-only actions",
    },
    circle: {
      classes: "items-center justify-center p-0 rounded-full",
      description: "Circular button for icon-only actions",
    },
  },
  size: {
    xs: {
      classes: "h-5 gap-1 rounded-sm px-1.5 text-xs",
      description: "Extra small button for compact UIs",
    },
    sm: {
      classes: "h-6.5 gap-1 rounded-md px-2 text-xs",
      description: "Small button for secondary actions",
    },
    base: { classes: "h-9 gap-1.5 rounded-lg px-3 text-base", description: "Default button size" },
    lg: {
      classes: "h-10 gap-2 rounded-lg px-4 text-base",
      description: "Large button for primary CTAs",
    },
  },
  compactSize: {
    xs: { classes: "size-3.5" },
    sm: { classes: "size-6.5" },
    base: { classes: "size-9" },
    lg: { classes: "size-10" },
  },
  variant: {
    primary: {
      classes:
        "relative overflow-hidden bg-(--tomui-button-emphasis-bg) !text-white ring ring-(--tomui-button-emphasis-ring) focus:ring-(--tomui-button-emphasis-ring) focus-visible:ring-(--tomui-button-emphasis-ring) active:ring-(--tomui-button-emphasis-ring) disabled:opacity-50",
      description: "High-emphasis button for primary actions",
    },
    secondary: {
      classes:
        "bg-tomui-base !text-tomui-default ring not-disabled:hover:bg-tomui-tint disabled:bg-tomui-base/50 disabled:!text-tomui-default/70 ring-tomui-line data-[state=open]:bg-tomui-base",
      description: "Default button style for most actions",
    },
    ghost: {
      classes: "text-tomui-default hover:bg-tomui-tint shadow-none bg-inherit",
      description: "Minimal button with no background",
    },
    destructive: {
      classes:
        "relative overflow-hidden bg-(--tomui-button-emphasis-bg) !text-white ring ring-(--tomui-button-emphasis-ring) focus:ring-(--tomui-button-emphasis-ring) focus-visible:ring-(--tomui-button-emphasis-ring) active:ring-(--tomui-button-emphasis-ring) disabled:opacity-50",
      description: "Danger button for destructive actions like delete",
    },
    "secondary-destructive": {
      classes:
        "bg-tomui-base !text-tomui-danger ring not-disabled:hover:!text-tomui-danger not-disabled:hover:ring-tomui-danger/30 disabled:bg-tomui-base/50 disabled:!text-tomui-danger/70 ring-tomui-line data-[state=open]:bg-tomui-base",
      description: "Secondary button with destructive text",
    },
    outline: {
      classes:
        "bg-transparent text-tomui-default ring ring-tomui-line transition-colors not-disabled:hover:text-tomui-strong not-disabled:hover:ring-tomui-focus/25",
      description: "Bordered button with transparent background",
    },
  },
} as const;

export const TOMUI_BUTTON_DEFAULT_VARIANTS = {
  form: "base",
  size: "base",
  variant: "secondary",
} as const;

export type TomuiButtonForm = keyof typeof TOMUI_BUTTON_VARIANTS.form;
export type TomuiButtonSize = keyof typeof TOMUI_BUTTON_VARIANTS.size;
export type TomuiButtonVariant = keyof typeof TOMUI_BUTTON_VARIANTS.variant;

export type ButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "title" | "type"
> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
  loading?: boolean;
  form?: TomuiButtonForm;
  size?: TomuiButtonSize;
  variant?: TomuiButtonVariant;
  title?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  type?: "button" | "submit" | "reset" | undefined;
};

export function buttonVariants(
  props: {
    variant?: TomuiButtonVariant;
    size?: TomuiButtonSize;
    form?: TomuiButtonForm;
  } = {},
): string {
  const merged = merge(TOMUI_BUTTON_DEFAULT_VARIANTS, props);
  const isCompactForm = () => merged.form === "square" || merged.form === "circle";
  return cn(
    "group flex w-max shrink-0 items-center font-medium select-none",
    "border-0 shadow-xs",
    "focus:ring-tomui-focus/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand",
    "cursor-pointer",
    "disabled:cursor-not-allowed disabled:text-tomui-subtle",
    resolveVariant(TOMUI_BUTTON_VARIANTS.size, merged.size, TOMUI_BUTTON_DEFAULT_VARIANTS.size)
      .classes,
    resolveVariant(TOMUI_BUTTON_VARIANTS.form, merged.form, TOMUI_BUTTON_DEFAULT_VARIANTS.form)
      .classes,
    isCompactForm() &&
      resolveVariant(
        TOMUI_BUTTON_VARIANTS.compactSize,
        merged.size,
        TOMUI_BUTTON_DEFAULT_VARIANTS.size,
      ).classes,
    resolveVariant(
      TOMUI_BUTTON_VARIANTS.variant,
      merged.variant,
      TOMUI_BUTTON_DEFAULT_VARIANTS.variant,
    ).classes,
  );
}

function emphasisStyle(variant: TomuiButtonVariant): JSX.CSSProperties | undefined {
  const token = () => {
    if (variant === "primary") return "var(--color-tomui-brand)";
    if (variant === "destructive") return "var(--color-tomui-danger)";
    return undefined;
  };
  const active = token();
  if (!active) return undefined;
  return {
    "--tomui-button-emphasis-ring": `color-mix(in oklch, ${active}, black 10%)`,
    "--tomui-button-emphasis-bg": `color-mix(in oklch, ${active}, white 30%)`,
    "--tomui-button-emphasis-gradient-start": `color-mix(in oklch, ${active}, white 15%)`,
    "--tomui-button-emphasis-gradient-end": active,
  } as JSX.CSSProperties;
}

function hasEmphasis(variant: TomuiButtonVariant): boolean {
  return variant === "primary" || variant === "destructive";
}

export function Button(props: ButtonProps) {
  const merged = merge(
    {
      form: TOMUI_BUTTON_DEFAULT_VARIANTS.form,
      size: TOMUI_BUTTON_DEFAULT_VARIANTS.size,
      variant: TOMUI_BUTTON_DEFAULT_VARIANTS.variant,
    },
    props,
  );
  const rest = omit(
    merged,
    "children",
    "class",
    "disabled",
    "loading",
    "form",
    "size",
    "variant",
    "icon",
    "style",
    "title",
    "type",
  );
  const style = (): JSX.CSSProperties | undefined => {
    const emphasis = emphasisStyle(merged.variant);
    if (!emphasis) return merged.style;
    return { ...emphasis, ...merged.style };
  };
  return (
    <button
      data-tomui-component="Button"
      class={cn(
        buttonVariants({ variant: merged.variant, size: merged.size, form: merged.form }),
        merged.class,
      )}
      disabled={merged.loading || merged.disabled}
      style={style()}
      type={merged.type ?? "button"}
      title={merged.title}
      {...rest}
    >
      <Show when={merged.loading}>
        <Loader size={merged.size === "lg" ? 16 : 14} />
      </Show>
      <Show when={!merged.loading && merged.icon && !hasEmphasis(merged.variant)}>
        {merged.icon}
      </Show>
      <Show
        when={hasEmphasis(merged.variant)}
        fallback={
          <Show when={merged.children}>{(kids) => <span class="contents">{kids()}</span>}</Show>
        }
      >
        <span
          aria-hidden="true"
          class="absolute inset-0 rounded-[inherit] bg-linear-to-b from-(--tomui-button-emphasis-gradient-start) to-(--tomui-button-emphasis-gradient-end) shadow-[inset_0_1px_0_0_var(--tomui-button-emphasis-bg)] group-hover:from-(--tomui-button-emphasis-bg)"
        />
        <span class="relative flex items-center gap-1.5">
          {merged.icon}
          <Show when={merged.children}>{(kids) => <span class="contents">{kids()}</span>}</Show>
        </span>
      </Show>
    </button>
  );
}

export type LinkButtonProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "style"> & {
  children?: JSX.Element;
  class?: string;
  disabled?: boolean;
  icon?: JSX.Element;
  external?: boolean;
  form?: TomuiButtonForm;
  size?: TomuiButtonSize;
  variant?: TomuiButtonVariant;
  style?: JSX.CSSProperties | undefined;
};

export function LinkButton(props: LinkButtonProps) {
  const merged = merge(
    {
      form: "base" as TomuiButtonForm,
      size: "base" as TomuiButtonSize,
      variant: "ghost" as TomuiButtonVariant,
    },
    props,
  );
  const rest = omit(
    merged,
    "children",
    "class",
    "disabled",
    "external",
    "form",
    "size",
    "variant",
    "icon",
    "style",
  );
  const style = (): JSX.CSSProperties | undefined => {
    const emphasis = emphasisStyle(merged.variant);
    if (!emphasis) return merged.style;
    return { ...emphasis, ...merged.style };
  };
  return (
    <Show
      when={merged.disabled}
      fallback={
        <a
          data-tomui-component="LinkButton"
          class={cn(
            buttonVariants({ variant: merged.variant, size: merged.size, form: merged.form }),
            "flex items-center no-underline! select-text",
            merged.class,
          )}
          style={style()}
          target={merged.external ? "_blank" : undefined}
          rel={merged.external ? "noopener noreferrer" : undefined}
          {...rest}
        >
          {merged.icon}
          {merged.children}
        </a>
      }
    >
      <button
        data-tomui-component="LinkButton"
        class={cn(
          buttonVariants({ variant: merged.variant, size: merged.size, form: "base" }),
          "select-text",
          merged.class,
        )}
        disabled
      >
        {merged.icon}
        {merged.children}
      </button>
    </Show>
  );
}

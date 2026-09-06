import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";

export const TOMUI_INPUT_VARIANTS = {
  size: {
    xs: {
      classes: "h-5 gap-1 rounded-sm px-1.5 text-xs",
      description: "Extra small input for compact UIs",
    },
    sm: {
      classes: "h-6.5 gap-1 rounded-md px-2 text-xs",
      description: "Small input for secondary fields",
    },
    base: {
      classes: "h-9 gap-1.5 rounded-lg px-3 text-base",
      description: "Default input size",
    },
    lg: {
      classes: "h-10 gap-2 rounded-lg px-4 text-base",
      description: "Large input for prominent fields",
    },
  },
  variant: {
    default: {
      classes: "focus:ring-tomui-focus/50 focus:ring-[1.5px]",
      description: "Default input appearance",
    },
    error: {
      classes: "!ring-tomui-danger focus:ring-tomui-danger/50 focus:ring-[1.5px]",
      description: "Error state for validation failures",
    },
  },
} as const;

export const TOMUI_INPUT_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export const TOMUI_INPUT_STYLING = {
  dimensions: {
    xs: { height: 20, paddingX: 6, fontSize: 12, borderRadius: 2, width: 160 },
    sm: { height: 26, paddingX: 8, fontSize: 12, borderRadius: 6, width: 200 },
    base: { height: 36, paddingX: 12, fontSize: 16, borderRadius: 8, width: 280 },
    lg: { height: 40, paddingX: 16, fontSize: 16, borderRadius: 8, width: 320 },
  },
  baseTokens: {
    background: "color-secondary",
    text: "text-color-surface",
    placeholder: "text-color-muted",
    ring: "color-border",
  },
  stateTokens: {
    focus: { ring: "color-active" },
    error: { ring: "color-error" },
    disabled: { opacity: 0.5, text: "text-color-muted" },
  },
} as const;

export type TomuiInputSize = keyof typeof TOMUI_INPUT_VARIANTS.size;
export type TomuiInputVariant = keyof typeof TOMUI_INPUT_VARIANTS.variant;

export interface TomuiInputVariantsProps {
  size?: TomuiInputSize | undefined;
  variant?: TomuiInputVariant | undefined;
  parentFocusIndicator?: boolean | undefined;
  focusIndicator?: boolean | undefined;
}

export function inputVariants(props: TomuiInputVariantsProps = {}): string {
  const merged = merge(
    { size: TOMUI_INPUT_DEFAULT_VARIANTS.size, variant: TOMUI_INPUT_DEFAULT_VARIANTS.variant },
    props,
  );
  return cn(
    "border-0 bg-tomui-control text-tomui-default ring ring-tomui-line outline-none focus:outline-none",
    "tomui-input-placeholder disabled:text-tomui-disabled",
    resolveVariant(TOMUI_INPUT_VARIANTS.size, merged.size, TOMUI_INPUT_DEFAULT_VARIANTS.size)
      .classes,
    resolveVariant(
      TOMUI_INPUT_VARIANTS.variant,
      merged.variant,
      TOMUI_INPUT_DEFAULT_VARIANTS.variant,
    ).classes,
    merged.parentFocusIndicator && merged.variant === "error"
      ? "focus-within:ring-[1.5px] focus-within:ring-tomui-danger/50"
      : "",
    merged.parentFocusIndicator && merged.variant !== "error"
      ? "focus-within:ring-[1.5px] focus-within:ring-tomui-focus/50"
      : "",
    merged.focusIndicator && merged.variant === "error"
      ? "focus:ring-[1.5px] focus:ring-tomui-danger/50"
      : "",
    merged.focusIndicator && merged.variant !== "error"
      ? "focus:ring-[1.5px] focus:ring-tomui-focus/50"
      : "",
  );
}

export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: TomuiInputSize | undefined;
  variant?: TomuiInputVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  description?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  passwordManagerIgnore?: boolean | undefined;
  class?: string | undefined;
};

export function Input(props: InputProps): JSX.Element {
  const merged = merge(
    { size: TOMUI_INPUT_DEFAULT_VARIANTS.size, passwordManagerIgnore: false },
    props,
  );
  const rest = omit(
    merged,
    "class",
    "size",
    "variant",
    "label",
    "labelTooltip",
    "description",
    "error",
    "passwordManagerIgnore",
  );
  const variant = (): TomuiInputVariant => merged.variant ?? (merged.error ? "error" : "default");
  const required = (): boolean | undefined => {
    if (rest.required === undefined || rest.required === false) return rest.required;
    return true;
  };
  const input = (): JSX.Element => (
    <input
      data-tomui-component="Input"
      class={cn(
        inputVariants({ size: merged.size, variant: variant(), focusIndicator: true }),
        merged.passwordManagerIgnore ? "keeper-ignore" : "",
        merged.class,
      )}
      data-1p-ignore={merged.passwordManagerIgnore ? "true" : undefined}
      data-bwignore={merged.passwordManagerIgnore ? "true" : undefined}
      data-form-type={merged.passwordManagerIgnore ? "other" : undefined}
      data-lpignore={merged.passwordManagerIgnore ? "true" : undefined}
      aria-invalid={merged.error ? "true" : rest["aria-invalid"]}
      {...rest}
    />
  );
  return (
    <Show when={merged.label || merged.error || merged.description} fallback={input()}>
      <Field
        label={merged.label}
        required={required()}
        labelTooltip={merged.labelTooltip}
        description={merged.description}
        error={normalizeFieldError(merged.error)}
      >
        {input()}
      </Field>
    </Show>
  );
}

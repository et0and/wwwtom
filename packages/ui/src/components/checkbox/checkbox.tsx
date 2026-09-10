import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { Label } from "../label/label";

export const TOMUI_CHECKBOX_VARIANTS = {
  variant: {
    default: {
      classes: "[&:focus-within>span]:ring-tomui-focus [&:hover>span]:ring-tomui-hairline",
      description: "Default checkbox appearance",
    },
    error: {
      classes: "[&>span]:ring-tomui-danger",
      description: "Error state for validation failures",
    },
  },
} as const;

export const TOMUI_CHECKBOX_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type TomuiCheckboxVariant = keyof typeof TOMUI_CHECKBOX_VARIANTS.variant;

export interface TomuiCheckboxVariantsProps {
  variant?: TomuiCheckboxVariant | undefined;
}

export function checkboxVariants(props: TomuiCheckboxVariantsProps = {}): string {
  const merged = merge({ variant: TOMUI_CHECKBOX_DEFAULT_VARIANTS.variant }, props);
  return cn(
    resolveVariant(
      TOMUI_CHECKBOX_VARIANTS.variant,
      merged.variant,
      TOMUI_CHECKBOX_DEFAULT_VARIANTS.variant,
    ).classes,
  );
}

export type CheckboxVariant = TomuiCheckboxVariant;

export type CheckboxProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "ref"
> & {
  variant?: CheckboxVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  controlFirst?: boolean | undefined;
  checked?: boolean | undefined;
  indeterminate?: boolean | undefined;
  disabled?: boolean | undefined;
  onCheckedChange?: ((checked: boolean, event: Event) => void) | undefined;
  name?: string | undefined;
  required?: boolean | undefined;
  class?: string | undefined;
  icon?: JSX.Element | undefined;
  ref?: ((element: HTMLInputElement) => void) | undefined;
  onChange?: JSX.ChangeEventHandler<HTMLInputElement, Event> | undefined;
};

function CheckboxControl(props: CheckboxProps): JSX.Element {
  const merged = merge({ variant: "default" as CheckboxVariant, indeterminate: false }, props);
  const rest = omit(
    merged,
    "variant",
    "label",
    "labelTooltip",
    "controlFirst",
    "checked",
    "indeterminate",
    "disabled",
    "onCheckedChange",
    "class",
    "icon",
    "ref",
    "onChange",
  );
  return (
    <span class={cn("relative inline-flex", checkboxVariants({ variant: merged.variant }))}>
      <input
        data-tomui-component="Checkbox"
        type="checkbox"
        checked={merged.checked}
        disabled={merged.disabled}
        aria-checked={merged.indeterminate ? "mixed" : merged.checked ? "true" : "false"}
        ref={(element: HTMLInputElement) => {
          element.indeterminate = merged.indeterminate;
          merged.ref?.(element);
        }}
        onChange={(event) => {
          merged.onChange?.(event);
          merged.onCheckedChange?.(event.currentTarget.checked, event);
        }}
        class={cn(
          "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border-0 bg-tomui-base ring outline-none",
          "focus-visible:ring-2 focus-visible:ring-tomui-brand",
          merged.variant === "error" ? "ring-tomui-danger" : "ring-tomui-hairline",
          "checked:bg-tomui-contrast checked:ring-tomui-contrast",
          merged.disabled ? "cursor-not-allowed opacity-50" : "",
          merged.class,
        )}
        {...rest}
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 hidden items-center justify-center text-tomui-inverse peer-checked:flex peer-indeterminate:flex"
      >
        <Show
          when={merged.icon}
          fallback={
            <span class="text-[12px] leading-none">{merged.indeterminate ? "–" : "✓"}</span>
          }
        >
          {merged.icon}
        </Show>
      </span>
    </span>
  );
}

function CheckboxBase(props: CheckboxProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  const rest = omit(merged, "label", "labelTooltip", "controlFirst", "disabled", "required");
  return (
    <Show when={merged.label} fallback={<CheckboxControl {...rest} disabled={merged.disabled} />}>
      <label
        data-tomui-component="Checkbox"
        class={cn(
          "m-0 inline-flex min-h-0 items-start gap-2 text-base",
          merged.controlFirst ? "flex-row" : "flex-row-reverse justify-end",
          merged.disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <CheckboxControl {...rest} disabled={merged.disabled} />
        <Label showOptional={merged.required === false} tooltip={merged.labelTooltip} asContent>
          {merged.label}
        </Label>
      </label>
    </Show>
  );
}

export interface CheckboxLegendProps {
  children?: JSX.Element | undefined;
  class?: string | undefined;
}

export function CheckboxLegend(props: CheckboxLegendProps): JSX.Element {
  return (
    <legend
      data-tomui-component="Checkbox"
      class={cn("text-base font-medium text-tomui-default", props.class)}
    >
      {props.children}
    </legend>
  );
}

export interface CheckboxGroupProps {
  legend?: string | undefined;
  children?: JSX.Element | undefined;
  error?: string | undefined;
  description?: JSX.Element | undefined;
  defaultValue?: Array<string> | undefined;
  value?: Array<string> | undefined;
  onValueChange?: ((value: Array<string>) => void) | undefined;
  disabled?: boolean | undefined;
  controlFirst?: boolean | undefined;
  class?: string | undefined;
}

export function CheckboxGroup(props: CheckboxGroupProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  return (
    <fieldset
      data-tomui-component="Checkbox"
      disabled={merged.disabled}
      class={cn("flex flex-col gap-4", merged.class)}
    >
      <Show when={merged.legend}>
        <CheckboxLegend>{merged.legend}</CheckboxLegend>
      </Show>
      <div class="flex flex-col gap-2">{merged.children}</div>
      <Show when={merged.error}>
        <p class="text-sm text-tomui-danger">{merged.error}</p>
      </Show>
      <Show when={merged.description}>
        <p class="text-sm text-tomui-subtle">{merged.description}</p>
      </Show>
    </fieldset>
  );
}

export type CheckboxItemProps = Omit<CheckboxProps, "label" | "onCheckedChange"> & {
  label: JSX.Element;
  value?: string | undefined;
  onCheckedChange?: ((checked: boolean, event: Event) => void) | undefined;
};

export function CheckboxItem(props: CheckboxItemProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  const rest = omit(merged, "label", "controlFirst", "disabled", "class");
  return (
    <label
      data-tomui-component="Checkbox"
      data-tomui-part="item-label"
      class={cn(
        "relative m-0 inline-flex items-start gap-2",
        !merged.controlFirst ? "flex-row-reverse justify-end" : "",
        merged.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        merged.class,
      )}
    >
      <CheckboxControl {...rest} disabled={merged.disabled} />
      <span class="text-base text-tomui-default">{merged.label}</span>
    </label>
  );
}

export const Checkbox = Object.assign(CheckboxBase, {
  Item: CheckboxItem,
  Group: CheckboxGroup,
  Legend: CheckboxLegend,
});

import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, merge, omit, Show, untrack } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { createToggleState } from "../../utils/state";
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
  "type" | "onChange" | "ref" | "checked" | "defaultChecked"
> & {
  variant?: CheckboxVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  controlFirst?: boolean | undefined;
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  indeterminate?: boolean | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  name?: string | undefined;
  value?: string | undefined;
  required?: boolean | undefined;
  class?: string | undefined;
  icon?: JSX.Element | undefined;
  ref?: ((element: HTMLInputElement) => void) | undefined;
};

function CheckboxControl(props: CheckboxProps): JSX.Element {
  const merged = merge(
    {
      variant: "default" as CheckboxVariant,
      indeterminate: false,
      value: "on",
    },
    props,
  );
  const rest = omit(
    merged,
    "variant",
    "label",
    "labelTooltip",
    "controlFirst",
    "checked",
    "defaultChecked",
    "indeterminate",
    "disabled",
    "readOnly",
    "onCheckedChange",
    "class",
    "icon",
    "ref",
    "name",
    "value",
  );

  const inputId = createUniqueId();
  const state = createToggleState({
    isSelected: () => merged.checked,
    defaultIsSelected: merged.defaultChecked,
    isDisabled: () => merged.disabled,
    isReadOnly: () => merged.readOnly,
    onSelectedChange: (checked) => merged.onCheckedChange?.(checked),
  });

  let inputRef: HTMLInputElement | undefined;
  let isFocused = false;
  let isSyncing = false;

  createEffect(
    () => merged.indeterminate,
    (indeterminate) => {
      const el = untrack(() => inputRef);
      if (el) el.indeterminate = indeterminate;
    },
  );

  createEffect(
    () => state.isSelected(),
    (checked) => {
      const el = untrack(() => inputRef);
      if (!el || el.checked === checked) return;
      isSyncing = true;
      el.checked = checked;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      isSyncing = false;
    },
  );

  return (
    <span
      class={cn("relative inline-flex", checkboxVariants({ variant: merged.variant }))}
      onPointerDown={(e) => {
        if (isFocused) e.preventDefault();
      }}
    >
      <input
        data-tomui-component="Checkbox"
        id={inputId}
        type="checkbox"
        name={merged.name}
        value={merged.value}
        checked={state.isSelected()}
        disabled={merged.disabled}
        readonly={merged.readOnly}
        required={merged.required}
        aria-checked={merged.indeterminate ? "mixed" : state.isSelected() ? "true" : "false"}
        aria-disabled={merged.disabled ? "true" : undefined}
        aria-readonly={merged.readOnly ? "true" : undefined}
        aria-required={merged.required ? "true" : undefined}
        ref={(element: HTMLInputElement) => {
          inputRef = element;
          element.indeterminate = merged.indeterminate;
          merged.ref?.(element);
        }}
        onFocus={() => {
          isFocused = true;
        }}
        onBlur={() => {
          isFocused = false;
        }}
        onChange={(event) => {
          if (isSyncing) return;
          state.toggle();
          const el = event.currentTarget;
          el.checked = state.isSelected();
        }}
        class={cn(
          "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border-0 bg-tomui-base ring outline-none",
          merged.variant === "error" ? "ring-tomui-danger" : "ring-tomui-hairline",
          !merged.disabled &&
            "hover:ring-tomui-hairline focus:ring-2 focus:ring-tomui-focus focus-visible:ring-2 focus-visible:ring-tomui-brand",
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <Show
                when={merged.indeterminate}
                fallback={
                  <path
                    d="M2.5 6.5L5 9L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                }
              >
                <path
                  d="M2.5 6H9.5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </Show>
            </svg>
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
          "!m-0 inline-flex !min-h-0 items-start gap-2 !text-base",
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
      class={cn("flex flex-col gap-4 p-0", merged.class)}
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
  onCheckedChange?: ((checked: boolean) => void) | undefined;
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

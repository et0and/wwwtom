import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { Field } from "../field/field";

export const TOMUI_SWITCH_VARIANTS = {
  size: {
    sm: { classes: "h-5.5 w-8.5", description: "Small switch for compact UIs" },
    base: { classes: "h-6.5 w-10.5", description: "Default switch size" },
    lg: { classes: "h-7.5 w-12.5", description: "Large switch for prominent toggles" },
  },
  variant: {
    default: {
      classes: "",
      description: "Default switch with squircle shape and brand blue color",
    },
    neutral: {
      classes: "",
      description: "Monochrome switch with squircle shape for subtle toggles",
    },
  },
} as const;

export const TOMUI_SWITCH_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type TomuiSwitchSize = keyof typeof TOMUI_SWITCH_VARIANTS.size;
export type TomuiSwitchVariant = keyof typeof TOMUI_SWITCH_VARIANTS.variant;

export interface TomuiSwitchVariantsProps {
  size?: TomuiSwitchSize | undefined;
  variant?: TomuiSwitchVariant | undefined;
}

export function switchVariants(props: TomuiSwitchVariantsProps = {}): string {
  const merged = merge(
    { size: TOMUI_SWITCH_DEFAULT_VARIANTS.size, variant: TOMUI_SWITCH_DEFAULT_VARIANTS.variant },
    props,
  );
  return cn(
    resolveVariant(TOMUI_SWITCH_VARIANTS.size, merged.size, TOMUI_SWITCH_DEFAULT_VARIANTS.size)
      .classes,
    resolveVariant(
      TOMUI_SWITCH_VARIANTS.variant,
      merged.variant,
      TOMUI_SWITCH_DEFAULT_VARIANTS.variant,
    ).classes,
  );
}

export type SwitchSize = TomuiSwitchSize;
export type SwitchVariant = TomuiSwitchVariant;

const SWITCH_TRACK = {
  sm: "h-4 w-8",
  base: "h-4.5 w-9",
  lg: "h-5 w-10",
} satisfies Record<TomuiSwitchSize, string>;

function trackColors(variant: TomuiSwitchVariant, checked: boolean): string {
  if (variant === "neutral") {
    return checked
      ? "bg-neutral-500 dark:bg-tomui-base ring-neutral-600 dark:ring-neutral-700"
      : "bg-neutral-150 dark:bg-tomui-base ring-tomui-hairline";
  }
  return checked
    ? "bg-blue-500 dark:bg-blue-600 ring-blue-600 dark:ring-blue-500"
    : "bg-neutral-200 dark:bg-neutral-700 ring-neutral-300 dark:ring-neutral-600";
}

function thumbColors(variant: TomuiSwitchVariant, checked: boolean): string {
  if (variant === "neutral") {
    return checked ? "bg-tomui-base dark:bg-neutral-400" : "bg-tomui-base dark:bg-neutral-850";
  }
  return checked ? "bg-tomui-base dark:bg-blue-300" : "bg-tomui-base dark:bg-neutral-850";
}

const SQUIRCLE_RADIUS =
  "rounded-[5px] supports-[corner-shape:squircle]:rounded-[10px] [corner-shape:squircle]";

export type SwitchProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "onChange"
> & {
  variant?: SwitchVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  required?: boolean | undefined;
  controlFirst?: boolean | undefined;
  size?: TomuiSwitchSize | undefined;
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  onCheckedChange?: ((checked: boolean, event: Event) => void) | undefined;
  transitioning?: boolean | undefined;
  icon?: JSX.Element | undefined;
  class?: string | undefined;
  onChange?: JSX.ChangeEventHandler<HTMLInputElement, Event> | undefined;
};

function isStringValue(value: JSX.Element | undefined): value is string {
  return value === String(value);
}

function SwitchControl(props: SwitchProps): JSX.Element {
  const merged = merge(
    { size: TOMUI_SWITCH_DEFAULT_VARIANTS.size, variant: TOMUI_SWITCH_DEFAULT_VARIANTS.variant },
    props,
  );
  const rest = omit(
    merged,
    "size",
    "variant",
    "label",
    "labelTooltip",
    "required",
    "controlFirst",
    "checked",
    "disabled",
    "onCheckedChange",
    "transitioning",
    "class",
    "icon",
    "id",
    "onChange",
    "aria-label",
  );
  const ariaLabel = (): string | undefined => {
    const direct = merged["aria-label"];
    if (direct === undefined || direct === false)
      return isStringValue(merged.label) ? merged.label : "Switch";
    return direct;
  };
  return (
    <span
      class={cn(
        "relative inline-flex",
        switchVariants({ size: merged.size, variant: merged.variant }),
      )}
    >
      <input
        data-tomui-component="Switch"
        type="checkbox"
        role="switch"
        id={merged.id}
        checked={merged.checked}
        disabled={merged.disabled}
        aria-checked={merged.checked ? "true" : "false"}
        aria-busy={merged.transitioning ? "true" : undefined}
        aria-label={ariaLabel()}
        onChange={(event) => {
          merged.onChange?.(event);
          merged.onCheckedChange?.(event.currentTarget.checked, event);
        }}
        class={cn(
          "peer cursor-pointer appearance-none border-none p-0 ring outline-none",
          "transition-colors duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-tomui-brand",
          "disabled:cursor-not-allowed disabled:opacity-50",
          SWITCH_TRACK[merged.size],
          SQUIRCLE_RADIUS,
          trackColors(merged.variant, merged.checked ?? false),
          merged.class,
        )}
        {...rest}
      />
      <span
        aria-hidden="true"
        class={cn(
          "pointer-events-none absolute top-0 bottom-0 left-0 shadow-[0_0_1px_0.5px_var(--color-tomui-shadow-edge),0_1px_2px_var(--color-tomui-shadow-drop)]",
          merged.size === "sm" ? "w-4 peer-checked:left-4" : "",
          merged.size === "base" ? "w-4.5 peer-checked:left-4.5" : "",
          merged.size === "lg" ? "w-5 peer-checked:left-5" : "",
          SQUIRCLE_RADIUS,
          thumbColors(merged.variant, merged.checked ?? false),
          "transition-all duration-150 ease-out motion-reduce:transition-none",
        )}
      />
    </span>
  );
}

function SwitchBase(props: SwitchProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  const rest = omit(merged, "label", "labelTooltip", "required", "controlFirst");
  return (
    <Show when={merged.label} fallback={<SwitchControl {...rest} />}>
      <Field
        label={merged.label}
        required={merged.required}
        labelTooltip={merged.labelTooltip}
        controlFirst={merged.controlFirst}
      >
        <SwitchControl {...rest} />
      </Field>
    </Show>
  );
}

export interface SwitchLegendProps {
  children?: JSX.Element | undefined;
  class?: string | undefined;
}

export function SwitchLegend(props: SwitchLegendProps): JSX.Element {
  return (
    <legend
      data-tomui-component="Switch"
      class={cn("text-base font-medium text-tomui-default", props.class)}
    >
      {props.children}
    </legend>
  );
}

export interface SwitchGroupProps {
  legend?: string | undefined;
  children?: JSX.Element | undefined;
  error?: string | undefined;
  description?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  controlFirst?: boolean | undefined;
  class?: string | undefined;
}

export function SwitchGroup(props: SwitchGroupProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  return (
    <fieldset
      data-tomui-component="Switch"
      disabled={merged.disabled}
      class={cn("flex flex-col gap-4", merged.class)}
    >
      <Show when={merged.legend}>
        <SwitchLegend>{merged.legend}</SwitchLegend>
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

export type SwitchItemProps = Omit<SwitchProps, "label"> & {
  label: string;
};

export function SwitchItem(props: SwitchItemProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "label", "disabled", "class");
  return (
    <label
      data-tomui-component="Switch"
      data-tomui-part="item-label"
      class={cn(
        "relative m-0 inline-flex items-center gap-2",
        merged.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        merged.class,
      )}
    >
      <SwitchControl {...rest} disabled={merged.disabled} />
      <span class="text-base font-medium text-tomui-default">{merged.label}</span>
    </label>
  );
}

export const Switch = Object.assign(SwitchBase, {
  Item: SwitchItem,
  Group: SwitchGroup,
  Legend: SwitchLegend,
});

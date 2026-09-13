import type { JSX } from "@solidjs/web";
import { createContext, createSignal, createUniqueId, merge, Show, useContext } from "solid-js";
import { cn } from "../../utils/cn";

export const TOMUI_RADIO_VARIANTS = {
  variant: {
    default: { classes: "ring-tomui-hairline", description: "Default radio appearance" },
    error: { classes: "ring-tomui-danger", description: "Error state for validation failures" },
  },
  appearance: {
    default: { classes: "", description: "Standard inline radio item" },
    card: {
      classes:
        "rounded-lg border border-tomui-hairline bg-tomui-base p-3 transition-colors hover:bg-tomui-tint has-[[data-checked]]:border-tomui-interact has-[[data-checked]]:bg-tomui-tint",
      description: "Choice card appearance with border, padding, and highlighted selection state",
    },
  },
} as const;

export const TOMUI_RADIO_DEFAULT_VARIANTS = {
  variant: "default",
  appearance: "default",
} as const;

export type TomuiRadioVariant = keyof typeof TOMUI_RADIO_VARIANTS.variant;
export type TomuiRadioAppearance = keyof typeof TOMUI_RADIO_VARIANTS.appearance;

export type RadioVariant = TomuiRadioVariant;
export type RadioControlPosition = "start" | "end";

interface RadioGroupContextValue {
  name: string;
  current: () => string | undefined;
  disabled: boolean;
  appearance: TomuiRadioAppearance;
  controlPosition: RadioControlPosition | undefined;
  select: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue>({
  name: "",
  current: () => undefined,
  disabled: false,
  appearance: "default",
  controlPosition: undefined,
  select: () => undefined,
});

export interface RadioLegendProps {
  children?: JSX.Element | undefined;
  class?: string | undefined;
}

export function RadioLegend(props: RadioLegendProps): JSX.Element {
  return (
    <legend
      data-tomui-component="Radio"
      class={cn("text-base font-medium text-tomui-default", props.class)}
    >
      {props.children}
    </legend>
  );
}

export interface RadioGroupProps {
  legend?: string | undefined;
  children?: JSX.Element | undefined;
  orientation?: "vertical" | "horizontal" | undefined;
  appearance?: TomuiRadioAppearance | undefined;
  error?: string | undefined;
  description?: JSX.Element | undefined;
  defaultValue?: string | undefined;
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
  controlPosition?: RadioControlPosition | undefined;
  name?: string | undefined;
  class?: string | undefined;
}

export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const merged = merge(
    { orientation: "vertical" as const, appearance: "default" as TomuiRadioAppearance },
    props,
  );
  const generatedName = createUniqueId();
  const [internal, setInternal] = createSignal(merged.defaultValue);
  const current = (): string | undefined => merged.value ?? internal();
  const contextValue: RadioGroupContextValue = {
    name: merged.name ?? generatedName,
    current,
    disabled: merged.disabled ?? false,
    appearance: merged.appearance,
    controlPosition: merged.controlPosition,
    select: (next: string) => {
      if (merged.value === undefined) setInternal(next);
      merged.onValueChange?.(next);
    },
  };
  return (
    <RadioGroupContext value={contextValue}>
      <fieldset
        data-tomui-component="Radio"
        disabled={merged.disabled}
        class={cn("flex flex-col gap-4", merged.class)}
      >
        <Show when={merged.legend}>
          <RadioLegend>{merged.legend}</RadioLegend>
        </Show>
        <div
          class={cn(
            merged.orientation === "vertical"
              ? cn("flex flex-col", merged.appearance === "card" ? "gap-3" : "gap-2")
              : merged.appearance === "card"
                ? "grid grid-cols-2 gap-3"
                : "flex flex-row flex-wrap gap-2",
          )}
        >
          {merged.children}
        </div>
        <Show when={merged.error}>
          <p class="text-sm text-tomui-danger">{merged.error}</p>
        </Show>
        <Show when={merged.description}>
          <p class="text-sm text-tomui-subtle">{merged.description}</p>
        </Show>
      </fieldset>
    </RadioGroupContext>
  );
}

export type RadioItemProps = {
  variant?: RadioVariant | undefined;
  appearance?: TomuiRadioAppearance | undefined;
  label: JSX.Element;
  description?: JSX.Element | undefined;
  value: string;
  class?: string | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
};

export function RadioItem(props: RadioItemProps): JSX.Element {
  const merged = merge({ variant: "default" as RadioVariant }, props);
  const context = useContext(RadioGroupContext);
  const appearance = (): TomuiRadioAppearance => merged.appearance ?? context.appearance;
  const isCard = (): boolean => appearance() === "card";
  const position = (): RadioControlPosition =>
    context.controlPosition ?? (isCard() ? "end" : "start");
  const checked = (): boolean => context.current() === merged.value;
  const disabled = (): boolean => merged.disabled ?? context.disabled;
  const name = (): string => merged.name ?? context.name;
  return (
    <Show
      when={isCard()}
      fallback={
        <label
          data-tomui-component="Radio"
          data-tomui-part="item-label"
          class={cn(
            "group relative m-0 inline-flex items-start gap-2",
            position() === "end" ? "flex-row-reverse justify-end" : "",
            disabled() ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            merged.class,
          )}
        >
          <span class="relative mt-0.5 inline-flex">
            <input
              data-tomui-component="Radio"
              data-tomui-part="item"
              type="radio"
              name={name()}
              value={merged.value}
              checked={checked()}
              disabled={disabled()}
              aria-checked={checked() ? "true" : "false"}
              onChange={() => context.select(merged.value)}
              class={cn(
                "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-tomui-base ring outline-none",
                merged.variant === "error" ? "ring-tomui-danger" : "ring-tomui-line",
                "checked:bg-tomui-contrast",
                "focus-visible:ring-2 focus-visible:ring-tomui-brand",
              )}
            />
            <span
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 hidden items-center justify-center peer-checked:flex"
            >
              <span class="h-2 w-2 rounded-full bg-tomui-base" />
            </span>
          </span>
          <span class="text-base text-tomui-default">{merged.label}</span>
        </label>
      }
    >
      <label
        data-tomui-component="Radio"
        data-tomui-part="item-label"
        class={cn(
          "group relative m-0 flex items-start gap-3 rounded-lg border border-tomui-hairline bg-tomui-base p-3 transition-colors has-[[data-checked]]:border-tomui-interact has-[[data-checked]]:bg-tomui-tint",
          position() === "start" ? "flex-row-reverse" : "",
          merged.variant === "error"
            ? "border-tomui-danger has-[[data-checked]]:border-tomui-danger has-[[data-checked]]:bg-tomui-base"
            : "",
          disabled() ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          merged.class,
        )}
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-base font-medium text-tomui-default">{merged.label}</span>
          <Show when={merged.description}>
            <span class="text-sm text-tomui-subtle">{merged.description}</span>
          </Show>
        </div>
        <span class="relative mt-0.5 inline-flex">
          <input
            data-tomui-component="Radio"
            data-tomui-part="item"
            type="radio"
            name={name()}
            value={merged.value}
            checked={checked()}
            disabled={disabled()}
            aria-checked={checked() ? "true" : "false"}
            data-checked={checked() ? "" : undefined}
            onChange={() => context.select(merged.value)}
            class={cn(
              "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-tomui-base ring-2 outline-none",
              merged.variant === "error" ? "ring-tomui-danger" : "ring-tomui-line",
              "checked:bg-tomui-contrast",
              "focus-visible:ring-2 focus-visible:ring-tomui-brand",
            )}
          />
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 hidden items-center justify-center peer-checked:flex"
          >
            <span class="h-2 w-2 rounded-full bg-tomui-base" />
          </span>
        </span>
      </label>
    </Show>
  );
}

export const Radio = Object.assign(RadioGroup, {
  Item: RadioItem,
  Group: RadioGroup,
  Legend: RadioLegend,
});

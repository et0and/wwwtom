import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { datePickerVariants, type TomuiDatePickerSize } from "../date-picker/date-picker";

export const TOMUI_DATE_RANGE_PICKER_VARIANTS = {
  size: {
    sm: { classes: "p-3 gap-2 text-xs", description: "Compact range picker for tight spaces" },
    base: { classes: "p-4 gap-2.5 text-sm", description: "Default range picker size" },
    lg: {
      classes: "p-5 gap-3 text-base",
      description: "Large range picker for prominent date selection",
    },
  },
  variant: {
    default: { classes: "bg-tomui-overlay", description: "Default range picker appearance" },
    subtle: {
      classes: "bg-tomui-base",
      description: "Subtle range picker with minimal background",
    },
  },
} as const;

export const TOMUI_DATE_RANGE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type TomuiDateRangePickerSize = keyof typeof TOMUI_DATE_RANGE_PICKER_VARIANTS.size;
export type TomuiDateRangePickerVariant = keyof typeof TOMUI_DATE_RANGE_PICKER_VARIANTS.variant;

export function dateRangePickerVariants(
  props: { size?: TomuiDateRangePickerSize; variant?: TomuiDateRangePickerVariant } = {},
): string {
  const merged = merge(TOMUI_DATE_RANGE_PICKER_DEFAULT_VARIANTS, props);
  return cn(
    "flex w-fit flex-col rounded-xl select-none",
    resolveVariant(
      TOMUI_DATE_RANGE_PICKER_VARIANTS.variant,
      merged.variant,
      TOMUI_DATE_RANGE_PICKER_DEFAULT_VARIANTS.variant,
    ).classes,
    resolveVariant(
      TOMUI_DATE_RANGE_PICKER_VARIANTS.size,
      merged.size,
      TOMUI_DATE_RANGE_PICKER_DEFAULT_VARIANTS.size,
    ).classes,
  );
}

export type DateRange = { start?: string | undefined; end?: string | undefined };

export type DateRangePickerProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  class?: string;
  inputClass?: string;
  size?: TomuiDatePickerSize;
  variant?: TomuiDateRangePickerVariant;
  start?: string;
  end?: string;
  min?: string;
  max?: string;
  onStartChange?: (value: string) => void;
  onEndChange?: (value: string) => void;
  onChange?: (range: DateRange) => void;
};

export function DateRangePicker(props: DateRangePickerProps) {
  const merged = merge(
    { size: "base" as TomuiDatePickerSize, variant: "default" as TomuiDateRangePickerVariant },
    props,
  );
  const rest = omit(
    merged,
    "class",
    "inputClass",
    "size",
    "variant",
    "start",
    "end",
    "min",
    "max",
    "onStartChange",
    "onEndChange",
    "onChange",
  );
  const isInvalid = () => Boolean(merged.start && merged.end && merged.start > merged.end);
  const rangeSize = (): TomuiDateRangePickerSize => (merged.size === "xs" ? "base" : merged.size);
  const handleStart: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const value = event.currentTarget.value;
    merged.onStartChange?.(value);
    merged.onChange?.({ start: value, end: merged.end });
  };
  const handleEnd: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const value = event.currentTarget.value;
    merged.onEndChange?.(value);
    merged.onChange?.({ start: merged.start, end: value });
  };
  return (
    <div
      data-tomui-component="DateRangePicker"
      class={cn(
        dateRangePickerVariants({ size: rangeSize(), variant: merged.variant }),
        merged.class,
      )}
      {...rest}
    >
      <div class="flex items-center gap-2">
        <input
          type="date"
          aria-label="Start date"
          class={cn(datePickerVariants({ size: merged.size }), merged.inputClass)}
          value={merged.start ?? ""}
          min={merged.min}
          max={merged.end || merged.max}
          onChange={handleStart}
        />
        <span aria-hidden="true" class="text-tomui-subtle">
          →
        </span>
        <input
          type="date"
          aria-label="End date"
          class={cn(datePickerVariants({ size: merged.size }), merged.inputClass)}
          value={merged.end ?? ""}
          min={merged.start || merged.min}
          max={merged.max}
          onChange={handleEnd}
        />
      </div>
      <Show when={isInvalid()}>
        <p role="alert" class="text-xs text-tomui-danger">
          Start date must be before end date.
        </p>
      </Show>
    </div>
  );
}

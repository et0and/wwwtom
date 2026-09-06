import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_DATE_PICKER_VARIANTS = {
  size: {
    xs: { classes: "h-5 px-1.5 text-xs", description: "Extra small date input for compact UIs" },
    sm: { classes: "h-6.5 px-2 text-xs", description: "Small date input for secondary fields" },
    base: { classes: "h-9 px-3 text-base", description: "Default date input size" },
    lg: { classes: "h-10 px-4 text-base", description: "Large date input for prominent fields" },
  },
} as const;

export const TOMUI_DATE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiDatePickerSize = keyof typeof TOMUI_DATE_PICKER_VARIANTS.size;

export function datePickerVariants(props: { size?: TomuiDatePickerSize } = {}): string {
  const merged = merge(TOMUI_DATE_PICKER_DEFAULT_VARIANTS, props);
  return cn(
    "rounded-xl bg-tomui-base text-tomui-default ring ring-tomui-line select-none",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand disabled:cursor-not-allowed disabled:opacity-50",
    resolveVariant(
      TOMUI_DATE_PICKER_VARIANTS.size,
      merged.size,
      TOMUI_DATE_PICKER_DEFAULT_VARIANTS.size,
    ).classes,
  );
}

export type DatePickerProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value"
> & {
  class?: string;
  size?: TomuiDatePickerSize;
  value?: string;
  onChange?: (value: string) => void;
};

export function DatePicker(props: DatePickerProps) {
  const merged = merge({ size: TOMUI_DATE_PICKER_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "class", "size", "value", "onChange");
  const handleChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    merged.onChange?.(event.currentTarget.value);
  };
  return (
    <input
      data-tomui-component="DatePicker"
      type="date"
      class={cn(datePickerVariants({ size: merged.size }), merged.class)}
      value={merged.value ?? ""}
      onChange={handleChange}
      {...rest}
    />
  );
}

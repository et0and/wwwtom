import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { cn } from "../../utils/cn";

export const TOMUI_METER_VARIANTS = {} as const;

export const TOMUI_METER_DEFAULT_VARIANTS = {} as const;

export interface TomuiMeterVariantsProps {}

export function meterVariants(_props: TomuiMeterVariantsProps = {}): string {
  return cn("flex w-full flex-col gap-2");
}

export type MeterProps = JSX.HTMLAttributes<HTMLDivElement> & {
  value: number;
  min?: number | undefined;
  max?: number | undefined;
  label: string;
  customValue?: string | undefined;
  showValue?: boolean | undefined;
  class?: string | undefined;
  trackClassName?: string | undefined;
  indicatorClassName?: string | undefined;
};

export function Meter(props: MeterProps): JSX.Element {
  const merged = merge({ showValue: true, min: 0, max: 100 }, props);
  const rest = omit(
    merged,
    "value",
    "min",
    "max",
    "label",
    "customValue",
    "showValue",
    "class",
    "trackClassName",
    "indicatorClassName",
  );
  const percent = (): number => {
    const span = merged.max - merged.min;
    if (span <= 0) return 0;
    return Math.min(100, Math.max(0, ((merged.value - merged.min) / span) * 100));
  };
  const displayValue = (): string => {
    if (merged.customValue) return merged.customValue;
    return `${Math.round(percent())}%`;
  };
  return (
    <div
      data-tomui-component="Meter"
      role="meter"
      aria-valuenow={merged.value}
      aria-valuemin={merged.min}
      aria-valuemax={merged.max}
      aria-label={merged.label}
      class={cn(meterVariants(), merged.class)}
      {...rest}
    >
      <div class="flex items-center justify-between gap-4">
        <span class="text-xs text-tomui-subtle">{merged.label}</span>
        <Show when={merged.customValue ?? merged.showValue}>
          <span class="text-sm font-medium text-tomui-default tabular-nums">{displayValue()}</span>
        </Show>
      </div>
      <div
        class={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-tomui-fill",
          merged.trackClassName,
        )}
      >
        <div
          class={cn(
            "absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-tomui-brand via-tomui-brand to-tomui-brand transition-[width] duration-300 ease-out",
            merged.indicatorClassName,
          )}
          style={{ width: `${percent()}%` }}
        />
      </div>
    </div>
  );
}

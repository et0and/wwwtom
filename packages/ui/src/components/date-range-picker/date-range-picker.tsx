import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ArrowRightIcon } from "@tom/icons/ArrowRight";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { datePickerVariants, type TomuiDatePickerSize } from "../date-picker/date-picker";

export const TOMUI_DATE_RANGE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type TomuiDateRangePickerSize = "sm" | "base" | "lg";
export type TomuiDateRangePickerVariant = "default" | "subtle";

const styles = stylex.create({
  root: {
    display: "flex",
    width: "fit-content",
    flexDirection: "column",
    borderRadius: radius.xl.borderRadius,
    userSelect: "none",
  },
  variantDefault: { backgroundColor: colors["--color-tomui-overlay"] },
  variantSubtle: { backgroundColor: colors["--color-tomui-base"] },
  sizeSm: { padding: "0.75rem", gap: "0.5rem" },
  sizeBase: { padding: "1rem", gap: "0.625rem" },
  sizeLg: { padding: "1.25rem", gap: "0.75rem" },
  row: { display: "flex", alignItems: "center", gap: "0.5rem" },
  alert: { fontSize: "0.75rem", color: textColors["--text-color-tomui-danger"] },
});

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiDateRangePickerSize, stylex.StyleXStyles>;

const variantStyles = {
  default: styles.variantDefault,
  subtle: styles.variantSubtle,
} as const satisfies Record<TomuiDateRangePickerVariant, stylex.StyleXStyles>;

export function dateRangePickerVariants(
  props: { size?: TomuiDateRangePickerSize; variant?: TomuiDateRangePickerVariant } = {},
) {
  const merged = merge(TOMUI_DATE_RANGE_PICKER_DEFAULT_VARIANTS, props);
  return [styles.root, variantStyles[merged.variant], sizeStyles[merged.size]];
}

export type DateRange = { start?: string | undefined; end?: string | undefined };

export type DateRangePickerProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "onChange" | "style"
> & {
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
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
    "style",
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
      {...stylex.attrs(
        ...dateRangePickerVariants({ size: rangeSize(), variant: merged.variant }),
        merged.style,
      )}
      {...rest}
    >
      <div {...stylex.attrs(styles.row)}>
        <input
          type="date"
          aria-label="Start date"
          {...stylex.attrs(...datePickerVariants({ size: merged.size }))}
          value={merged.start ?? ""}
          min={merged.min}
          max={merged.end || merged.max}
          onChange={handleStart}
        />
        <ArrowRightIcon size="sm" color="subtle" />
        <input
          type="date"
          aria-label="End date"
          {...stylex.attrs(...datePickerVariants({ size: merged.size }))}
          value={merged.end ?? ""}
          min={merged.start || merged.min}
          max={merged.max}
          onChange={handleEnd}
        />
      </div>
      <Show when={isInvalid()}>
        <p role="alert" {...stylex.attrs(styles.alert)}>
          Start date must be before end date.
        </p>
      </Show>
    </div>
  );
}

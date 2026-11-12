import * as stylex from "@stylexjs/stylex";
import { createSignal, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ArrowRightIcon } from "@tom/icons/ArrowRight";
import { colors, textColors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { datePickerVariants, type MidoriDatePickerSize } from "../date-picker/date-picker";

export const MIDORI_DATE_RANGE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type MidoriDateRangePickerSize = "sm" | "base" | "lg";
export type MidoriDateRangePickerVariant = "default" | "subtle";

const styles = stylex.create({
  root: {
    display: "flex",
    width: "fit-content",
    flexDirection: "column",
    borderRadius: radius.lg,
    userSelect: "none",
  },
  variantDefault: { backgroundColor: colors["--color-midori-layer-01"] },
  variantSubtle: { backgroundColor: colors["--color-midori-base"] },
  sizeSm: { padding: "0.75rem", gap: "0.5rem" },
  sizeBase: { padding: "0.75rem", gap: "0.5rem" },
  sizeLg: { padding: "1rem", gap: "0.625rem" },
  row: { display: "flex", alignItems: "center", gap: "0.5rem" },
  alert: { fontSize: "0.75rem", color: textColors["--text-color-midori-danger"] },
});

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<MidoriDateRangePickerSize, stylex.StyleXStyles>;

const variantStyles = {
  default: styles.variantDefault,
  subtle: styles.variantSubtle,
} as const satisfies Record<MidoriDateRangePickerVariant, stylex.StyleXStyles>;

export function dateRangePickerVariants(
  props: { size?: MidoriDateRangePickerSize; variant?: MidoriDateRangePickerVariant } = {},
) {
  const merged = merge(MIDORI_DATE_RANGE_PICKER_DEFAULT_VARIANTS, props);
  return [styles.root, variantStyles[merged.variant], sizeStyles[merged.size]];
}

export type DateRange = { start?: string | undefined; end?: string | undefined };

export type DateRangePickerProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "onChange" | "style"
> & {
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  size?: MidoriDatePickerSize;
  variant?: MidoriDateRangePickerVariant;
  start?: string;
  end?: string;
  defaultStart?: string;
  defaultEnd?: string;
  min?: string;
  max?: string;
  onStartChange?: (value: string) => void;
  onEndChange?: (value: string) => void;
  onChange?: (range: DateRange) => void;
};

export function DateRangePicker(props: DateRangePickerProps) {
  const merged = merge(
    {
      size: "base" as MidoriDatePickerSize,
      variant: "default" as MidoriDateRangePickerVariant,
      defaultStart: undefined,
      defaultEnd: undefined,
    },
    props,
  );
  const rest = omit(
    merged,
    "style",
    "size",
    "variant",
    "start",
    "end",
    "defaultStart",
    "defaultEnd",
    "min",
    "max",
    "onStartChange",
    "onEndChange",
    "onChange",
  );
  const [uncontrolledStart, setUncontrolledStart] = createSignal(merged.defaultStart);
  const [uncontrolledEnd, setUncontrolledEnd] = createSignal(merged.defaultEnd);
  const start = (): string | undefined => merged.start ?? uncontrolledStart();
  const end = (): string | undefined => merged.end ?? uncontrolledEnd();
  const isInvalid = () => Boolean(start() && end() && start()! > end()!);
  const rangeSize = (): MidoriDateRangePickerSize => (merged.size === "xs" ? "base" : merged.size);
  const handleStart: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const value = event.currentTarget.value;
    if (merged.start === undefined) setUncontrolledStart(value);
    merged.onStartChange?.(value);
    merged.onChange?.({ start: value, end: end() });
  };
  const handleEnd: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const value = event.currentTarget.value;
    if (merged.end === undefined) setUncontrolledEnd(value);
    merged.onEndChange?.(value);
    merged.onChange?.({ start: start(), end: value });
  };
  return (
    <div
      data-midori-component="DateRangePicker"
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
          value={start() ?? ""}
          min={merged.min}
          max={end() || merged.max}
          onChange={handleStart}
        />
        <ArrowRightIcon size="sm" color="subtle" />
        <input
          type="date"
          aria-label="End date"
          {...stylex.attrs(...datePickerVariants({ size: merged.size }))}
          value={end() ?? ""}
          min={start() || merged.min}
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

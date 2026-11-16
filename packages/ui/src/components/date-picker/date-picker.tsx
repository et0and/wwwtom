import * as stylex from "@stylexjs/stylex";
import { createSignal, merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";

export const MIDORI_DATE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type MidoriDatePickerSize = "xs" | "sm" | "base" | "lg";

const styles = stylex.create({
  base: {
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors["--color-midori-control"],
    color: textColors["--text-color-midori-default"],
    fontFamily: "inherit",
    userSelect: "none",
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "-1px",
    boxShadow: elevation["--elevation-midori-input"],
    ":hover": { backgroundColor: colors["--color-midori-layer-01"] },
    ":focus": { outlineColor: colors["--color-midori-focus"], boxShadow: "none" },
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
  },
  sizeXs: { height: "1.5rem", paddingInline: "0.5rem", fontSize: "12px" },
  sizeSm: { height: "1.5rem", paddingInline: "0.5625rem", fontSize: "13px" },
  sizeBase: { height: "1.75rem", paddingInline: "0.6875rem", fontSize: "13px" },
  sizeLg: { height: "2rem", paddingInline: "0.9375rem", fontSize: "13px" },
});

const sizeStyles = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<MidoriDatePickerSize, stylex.StyleXStyles>;

/** The return type is inferred because StyleX types a pseudo-only member as a
    pseudo map, which `stylex.StyleXStyles` does not cover. */
export function datePickerVariants(props: { size?: MidoriDatePickerSize } = {}) {
  const merged = merge(MIDORI_DATE_PICKER_DEFAULT_VARIANTS, props);
  return [styles.base, sizeStyles[merged.size]];
}

export type DatePickerProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value" | "style"
> & {
  size?: MidoriDatePickerSize;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DatePicker(props: DatePickerProps) {
  const merged = merge({ size: MIDORI_DATE_PICKER_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "style", "size", "value", "defaultValue", "onChange");
  const [uncontrolledValue, setUncontrolledValue] = createSignal(merged.defaultValue ?? "");
  const value = (): string => merged.value ?? uncontrolledValue();
  const handleChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const next = event.currentTarget.value;
    if (merged.value === undefined) setUncontrolledValue(next);
    merged.onChange?.(next);
  };
  return (
    <input
      data-midori-component="DatePicker"
      type="date"
      {...stylex.attrs(...datePickerVariants({ size: merged.size }), merged.style)}
      value={value()}
      onChange={handleChange}
      {...rest}
    />
  );
}

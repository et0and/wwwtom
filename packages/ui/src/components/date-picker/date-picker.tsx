import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_DATE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiDatePickerSize = "xs" | "sm" | "base" | "lg";

const styles = stylex.create({
  base: {
    borderWidth: 0,
    borderRadius: radius.xl.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    color: textColors["--text-color-tomui-default"],
    userSelect: "none",
    outlineWidth: 0,
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"],
    ":focus": { outlineWidth: 0 },
    ":focus-visible": { boxShadow: "0 0 0 2px " + colors["--color-tomui-brand"] },
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
  },
  sizeXs: { height: "1.25rem", paddingInline: "0.375rem", fontSize: "0.75rem" },
  sizeSm: { height: "1.625rem", paddingInline: "0.5rem", fontSize: "0.75rem" },
  sizeBase: { height: "2.25rem", paddingInline: "0.75rem", fontSize: "0.875rem" },
  sizeLg: { height: "2.5rem", paddingInline: "1rem", fontSize: "0.875rem" },
});

const sizeStyles = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiDatePickerSize, stylex.StyleXStyles>;

/** The return type is inferred because StyleX types a pseudo-only member as a
    pseudo map, which `stylex.StyleXStyles` does not cover. */
export function datePickerVariants(props: { size?: TomuiDatePickerSize } = {}) {
  const merged = merge(TOMUI_DATE_PICKER_DEFAULT_VARIANTS, props);
  return [styles.base, sizeStyles[merged.size]];
}

export type DatePickerProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value" | "style"
> & {
  size?: TomuiDatePickerSize;
  value?: string;
  onChange?: (value: string) => void;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function DatePicker(props: DatePickerProps) {
  const merged = merge({ size: TOMUI_DATE_PICKER_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "style", "size", "value", "onChange");
  const handleChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    merged.onChange?.(event.currentTarget.value);
  };
  return (
    <input
      data-tomui-component="DatePicker"
      type="date"
      {...stylex.attrs(...datePickerVariants({ size: merged.size }), merged.style)}
      value={merged.value ?? ""}
      onChange={handleChange}
      {...rest}
    />
  );
}

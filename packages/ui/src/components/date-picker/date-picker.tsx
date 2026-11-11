import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";

export const TOMUI_DATE_PICKER_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiDatePickerSize = "xs" | "sm" | "base" | "lg";

const styles = stylex.create({
  base: {
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors["--color-tomui-control"],
    color: textColors["--text-color-tomui-default"],
    fontFamily: "inherit",
    userSelect: "none",
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "-1px",
    boxShadow: elevation["--elevation-tomui-input"],
    ":hover": { backgroundColor: colors["--color-tomui-layer-01"] },
    ":focus": { outlineColor: colors["--color-tomui-focus"], boxShadow: "none" },
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

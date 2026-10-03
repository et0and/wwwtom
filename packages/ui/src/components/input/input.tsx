import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeXs } from "../../styles/typography.stylex";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";

const focusColor = colors["--color-tomui-focus"];
const dangerColor = textColors["--text-color-tomui-danger"];
/** Matches Tailwind's `ring-<color>/50` alpha modifier. StyleX needs literals. */
const focusRing = "0 0 0 1.5px color-mix(in srgb, " + focusColor + " 50%, transparent)";
const dangerRing = "0 0 0 1.5px color-mix(in srgb, " + dangerColor + " 50%, transparent)";

export const TOMUI_INPUT_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type TomuiInputSize = "xs" | "sm" | "base" | "lg";
export type TomuiInputVariant = "default" | "error";

export interface TomuiInputVariantsProps {
  size?: TomuiInputSize | undefined;
  variant?: TomuiInputVariant | undefined;
  parentFocusIndicator?: boolean | undefined;
  focusIndicator?: boolean | undefined;
}

const styles = stylex.create({
  base: {
    borderWidth: 0,
    backgroundColor: colors["--color-tomui-control"],
    color: textColors["--text-color-tomui-default"],
    outlineWidth: 0,
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"],
    // StyleX compiles this to a real ::placeholder rule, replacing the old
    // vanilla .tomui-input-placeholder class.
    "::placeholder": { color: textColors["--text-color-tomui-placeholder"] },
  },
  sizeXs: {
    height: "1.25rem",
    paddingInline: "0.375rem",
    borderRadius: radius.sm.borderRadius,
    fontSize: fontSizeXs.fontSize,
  },
  sizeSm: {
    height: "1.625rem",
    paddingInline: "0.5rem",
    borderRadius: radius.md.borderRadius,
    fontSize: fontSizeXs.fontSize,
  },
  sizeBase: {
    height: "2.25rem",
    paddingInline: "0.75rem",
    borderRadius: radius.lg.borderRadius,
    fontSize: fontSizeBase.fontSize,
  },
  sizeLg: {
    height: "2.5rem",
    paddingInline: "1rem",
    borderRadius: radius.lg.borderRadius,
    fontSize: fontSizeBase.fontSize,
  },
  /** At rest the error ring replaces the line ring, as the old !ring override did. */
  variantError: { boxShadow: "0 0 0 1px " + dangerColor },
  focus: { ":focus": { boxShadow: focusRing } },
  focusError: { ":focus": { boxShadow: dangerRing } },
  parentFocus: { ":focus-within": { boxShadow: focusRing } },
  parentFocusError: { ":focus-within": { boxShadow: dangerRing } },
});

const sizeStyles = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiInputSize, stylex.StyleXStyles>;

/**
 * The return type is inferred on purpose: StyleX types a `create` member that
 * holds only pseudo keys as a pseudo map, which `stylex.StyleXStyles` does not
 * cover. Spreading the result into `stylex.attrs()` works regardless.
 */
export function inputVariants(props: TomuiInputVariantsProps = {}) {
  const merged = merge(TOMUI_INPUT_DEFAULT_VARIANTS, props);
  const isError = merged.variant === "error";
  const focusStyle = () => {
    if (merged.parentFocusIndicator) return isError ? styles.parentFocusError : styles.parentFocus;
    if (merged.focusIndicator) return isError ? styles.focusError : styles.focus;
    return undefined;
  };
  const parts = [
    styles.base,
    sizeStyles[merged.size],
    isError ? styles.variantError : undefined,
    focusStyle(),
  ];
  return parts.filter((style) => style !== undefined);
}

export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size" | "style"> & {
  size?: TomuiInputSize | undefined;
  variant?: TomuiInputVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  description?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  passwordManagerIgnore?: boolean | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Input(props: InputProps): JSX.Element {
  const merged = merge(
    { size: TOMUI_INPUT_DEFAULT_VARIANTS.size, passwordManagerIgnore: false },
    props,
  );
  const rest = omit(
    merged,
    "size",
    "variant",
    "label",
    "labelTooltip",
    "description",
    "error",
    "passwordManagerIgnore",
    "style",
  );
  const variant = (): TomuiInputVariant => merged.variant ?? (merged.error ? "error" : "default");
  const required = (): boolean | undefined => {
    if (rest.required === undefined || rest.required === false) return rest.required;
    return true;
  };
  const input = (): JSX.Element => (
    <input
      data-tomui-component="Input"
      {...stylex.attrs(
        ...inputVariants({
          size: merged.size,
          variant: variant(),
          focusIndicator: true,
        }),
        merged.style,
      )}
      data-1p-ignore={merged.passwordManagerIgnore ? "true" : undefined}
      data-bwignore={merged.passwordManagerIgnore ? "true" : undefined}
      data-form-type={merged.passwordManagerIgnore ? "other" : undefined}
      data-lpignore={merged.passwordManagerIgnore ? "true" : undefined}
      aria-invalid={merged.error ? "true" : rest["aria-invalid"]}
      {...rest}
    />
  );
  return (
    <Show when={merged.label || merged.error || merged.description} fallback={input()}>
      <Field
        label={merged.label}
        required={required()}
        labelTooltip={merged.labelTooltip}
        description={merged.description}
        error={normalizeFieldError(merged.error)}
      >
        {input()}
      </Field>
    </Show>
  );
}

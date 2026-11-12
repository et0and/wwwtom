import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createUniqueId, merge, omit, Show } from "solid-js";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs } from "../../styles/typography.stylex";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";

const focusColor = colors["--color-midori-focus"];
const dangerColor = textColors["--text-color-midori-danger"];

export const MIDORI_INPUT_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type MidoriInputSize = "xs" | "sm" | "base" | "lg";
export type MidoriInputVariant = "default" | "error";

export interface MidoriInputVariantsProps {
  size?: MidoriInputSize | undefined;
  variant?: MidoriInputVariant | undefined;
  parentFocusIndicator?: boolean | undefined;
  focusIndicator?: boolean | undefined;
}

const styles = stylex.create({
  base: {
    width: "100%",
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors["--color-midori-control"],
    color: textColors["--text-color-midori-default"],
    fontFamily: "inherit",
    fontWeight: 440,
    fontSize: fontSizeSm.fontSize,
    lineHeight: "20px",
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "-1px",
    boxShadow: elevation["--elevation-midori-input"],
    ":hover": { backgroundColor: colors["--color-midori-layer-01"] },
    ":disabled": { opacity: 0.5, cursor: "not-allowed" },
    // StyleX compiles this to a real ::placeholder rule, which replaces the old
    // vanilla .midori-input-placeholder class.
    "::placeholder": { color: textColors["--text-color-midori-placeholder"] },
  },
  sizeXs: {
    height: "1.5rem",
    paddingInline: "0.5rem",
    borderRadius: radius.sm,
    fontSize: fontSizeXs.fontSize,
    lineHeight: "16px",
  },
  sizeSm: {
    height: "1.5rem",
    paddingInline: "0.5625rem",
    borderRadius: radius.sm,
    fontSize: fontSizeSm.fontSize,
  },
  sizeBase: {
    height: "1.75rem",
    paddingInline: "0.6875rem",
    borderRadius: radius.md,
    fontSize: fontSizeSm.fontSize,
  },
  sizeLg: {
    height: "2rem",
    paddingInline: "0.9375rem",
    borderRadius: radius.md,
    fontSize: fontSizeSm.fontSize,
  },
  /** At rest the error ring replaces the input elevation, as OpenCode does. */
  variantError: { outlineWidth: "1px", outlineColor: dangerColor, boxShadow: "none" },
  focus: {
    outlineWidth: "1px",
    outlineColor: focusColor,
    boxShadow: "none",
  },
  focusError: {
    outlineWidth: "1px",
    outlineColor: dangerColor,
    boxShadow: "none",
  },
  parentFocus: {
    ":focus-within": {
      outlineWidth: "1px",
      outlineColor: focusColor,
      boxShadow: "none",
    },
  },
  parentFocusError: {
    ":focus-within": {
      outlineWidth: "1px",
      outlineColor: dangerColor,
      boxShadow: "none",
    },
  },
});

const sizeStyles = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<MidoriInputSize, stylex.StyleXStyles>;

/**
 * The return type is inferred on purpose: StyleX types a `create` member that
 * holds only pseudo keys as a pseudo map, which `stylex.StyleXStyles` does not
 * cover. Spreading the result into `stylex.attrs()` works regardless.
 */
export function inputVariants(props: MidoriInputVariantsProps = {}) {
  const merged = merge(MIDORI_INPUT_DEFAULT_VARIANTS, props);
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
  size?: MidoriInputSize | undefined;
  variant?: MidoriInputVariant | undefined;
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
    { size: MIDORI_INPUT_DEFAULT_VARIANTS.size, passwordManagerIgnore: false },
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
  const variant = (): MidoriInputVariant => merged.variant ?? (merged.error ? "error" : "default");
  const required = (): boolean | undefined => {
    if (rest.required === undefined || rest.required === false) return rest.required;
    return true;
  };
  const generatedId = createUniqueId();
  const controlId = (): string =>
    merged.id === undefined || merged.id === false ? generatedId : merged.id;
  const input = (): JSX.Element => (
    <input
      data-midori-component="Input"
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
      id={controlId()}
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
        controlId={controlId()}
      >
        {input()}
      </Field>
    </Show>
  );
}

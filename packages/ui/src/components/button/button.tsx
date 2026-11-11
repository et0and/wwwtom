import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { layout, radius, select } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs, fontWeightControl } from "../../styles/typography.stylex";
import { customProperties } from "../../utils/stylex-vars";
import { buttonEmphasisVars } from "./button-vars.stylex";
import { Loader } from "../loader/loader";

export const TOMUI_BUTTON_DEFAULT_VARIANTS = {
  form: "base",
  size: "base",
  variant: "secondary",
} as const;

export type TomuiButtonForm = "base" | "square" | "circle";
export type TomuiButtonSize = "xs" | "sm" | "base" | "lg";
export type TomuiButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "secondary-destructive"
  | "outline"
  | "neutral"
  | "contrast"
  | "danger"
  | "warning"
  | "ghost-muted"
  | "ghost-faint";

const disabledBase = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const disabledContrast = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const styles = stylex.create({
  base: {
    position: "relative",
    display: "inline-flex",
    width: "max-content",
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: radius.md,
    fontFamily: "inherit",
    fontWeight: fontWeightControl.fontWeight,
    fontSize: fontSizeSm.fontSize,
    lineHeight: "20px",
    fontVariantNumeric: "tabular-nums",
    textShadow: "none",
    textDecorationLine: "none",
    userSelect: "none",
    cursor: "pointer",
    // Colour changes are immediate, never transitioned.
    transitionProperty: "none",
  },

  // Forms
  formBase: {},
  formSquare: { alignItems: "center", justifyContent: "center", padding: 0 },
  formCircle: {
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: radius.full,
  },

  // Sizes. OpenCode uses 20/24/28/32px controls with 4px and 6px radii.
  sizeXs: {
    height: "1.25rem",
    gap: "0.25rem",
    borderRadius: radius.sm,
    paddingInline: "0.375rem",
    fontSize: fontSizeXs.fontSize,
    lineHeight: "16px",
  },
  sizeSm: {
    height: "1.5rem",
    gap: "0.375rem",
    borderRadius: radius.sm,
    paddingInline: "0.5625rem",
    fontSize: fontSizeSm.fontSize,
  },
  sizeBase: {
    height: "1.75rem",
    gap: "0.375rem",
    borderRadius: radius.md,
    paddingInline: "0.6875rem",
    fontSize: fontSizeSm.fontSize,
  },
  sizeLg: {
    height: "2rem",
    gap: "0.375rem",
    borderRadius: radius.md,
    paddingInline: "0.9375rem",
    fontSize: fontSizeSm.fontSize,
  },

  // Square extents used when the form is square or circle.
  compactXs: { width: "1.25rem", height: "1.25rem", paddingInline: 0 },
  compactSm: { width: "1.5rem", height: "1.5rem", paddingInline: 0 },
  compactBase: { width: "1.75rem", height: "1.75rem", paddingInline: 0 },
  compactLg: { width: "2rem", height: "2rem", paddingInline: 0 },

  // Emphasis variants. primary, contrast, and destructive share one rule; the
  // inline accent vars set by `emphasisStyle` are what differ.
  emphasis: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: buttonEmphasisVars.bg,
    color: textColors["--text-color-tomui-inverse"],
    textShadow: "0 0.5px 0.5px rgb(0 0 0 / 0.3)",
    boxShadow: elevation["--elevation-tomui-button-contrast"],
    ":disabled": disabledContrast,
  },
  neutral: {
    backgroundColor: colors["--color-tomui-button-neutral"],
    color: textColors["--text-color-tomui-default"],
    boxShadow: elevation["--elevation-tomui-button-neutral"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
    ":disabled": disabledBase,
  },
  secondary: {
    backgroundColor: colors["--color-tomui-button-neutral"],
    color: textColors["--text-color-tomui-default"],
    boxShadow: elevation["--elevation-tomui-button-neutral"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
    ":disabled": disabledBase,
  },
  "secondary-destructive": {
    backgroundColor: colors["--color-tomui-button-neutral"],
    color: textColors["--text-color-tomui-danger"],
    boxShadow: elevation["--elevation-tomui-button-neutral"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
    ":disabled": disabledBase,
  },
  danger: {
    backgroundColor: colors["--color-tomui-button-neutral"],
    color: textColors["--text-color-tomui-danger"],
    boxShadow: elevation["--elevation-tomui-button-neutral"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
    ":disabled": disabledBase,
  },
  warning: {
    backgroundColor: colors["--color-tomui-button-neutral"],
    color: textColors["--text-color-tomui-warning"],
    boxShadow: elevation["--elevation-tomui-button-neutral"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
    ":disabled": disabledBase,
  },
  ghost: {
    color: textColors["--text-color-tomui-default"],
    backgroundColor: "transparent",
    ":hover": { backgroundColor: colors["--color-tomui-overlay-hover"] },
    ":active": { backgroundColor: colors["--color-tomui-overlay-pressed"] },
    ":disabled": disabledBase,
  },
  "ghost-muted": {
    color: textColors["--text-color-tomui-subtle"],
    backgroundColor: "transparent",
    ":hover": {
      backgroundColor: colors["--color-tomui-overlay-hover"],
      color: textColors["--text-color-tomui-default"],
    },
    ":active": { backgroundColor: colors["--color-tomui-overlay-pressed"] },
    ":disabled": disabledBase,
  },
  "ghost-faint": {
    color: textColors["--text-color-tomui-inactive"],
    backgroundColor: "transparent",
    ":hover": {
      backgroundColor: colors["--color-tomui-overlay-hover"],
      color: textColors["--text-color-tomui-subtle"],
    },
    ":disabled": disabledBase,
  },
  outline: {
    backgroundColor: "transparent",
    color: textColors["--text-color-tomui-default"],
    boxShadow: "inset 0 0 0 1px " + colors["--color-tomui-hairline"],
    ":hover": { backgroundColor: colors["--color-tomui-overlay-hover"] },
    ":active": { backgroundColor: colors["--color-tomui-overlay-pressed"] },
    ":disabled": disabledBase,
  },

  // Focus ring. OpenCode outlines outside the control rather than painting a
  // second box shadow, so the neutral elevation survives focus.
  focusRing: {
    outlineStyle: "solid",
    outlineOffset: "2.5px",
    outlineWidth: "2px",
    outlineColor: {
      default: "transparent",
      ":focus-visible": colors["--color-tomui-focus"],
    },
  },

  // Gradient overlay for emphasis variants.
  overlay: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    backgroundImage:
      "linear-gradient(to bottom, " +
      buttonEmphasisVars.gradientStart +
      ", " +
      buttonEmphasisVars.gradientEnd +
      ")",
  },
  content: { position: "relative", display: "flex", alignItems: "center", gap: "0.375rem" },
  noUnderline: { textDecorationLine: "none" },
});

/**
 * Form, size, and variant maps. StyleX cannot index a nested namespace, so
 * each axis gets its own flat map keyed by variant name.
 */
const formStyles = {
  base: styles.formBase,
  square: styles.formSquare,
  circle: styles.formCircle,
} as const satisfies Record<TomuiButtonForm, stylex.StyleXStyles>;

const sizeStyles = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiButtonSize, stylex.StyleXStyles>;

const compactStyles = {
  xs: styles.compactXs,
  sm: styles.compactSm,
  base: styles.compactBase,
  lg: styles.compactLg,
} as const satisfies Record<TomuiButtonSize, stylex.StyleXStyles>;

const variantStyles = {
  primary: styles.emphasis,
  contrast: styles.emphasis,
  destructive: styles.emphasis,
  secondary: styles.secondary,
  neutral: styles.neutral,
  danger: styles.danger,
  warning: styles.warning,
  ghost: styles.ghost,
  "ghost-muted": styles["ghost-muted"],
  "ghost-faint": styles["ghost-faint"],
  "secondary-destructive": styles["secondary-destructive"],
  outline: styles.outline,
} as const satisfies Record<TomuiButtonVariant, stylex.StyleXStyles>;

const isCompactForm = (form: TomuiButtonForm): boolean => form === "square" || form === "circle";

const hasEmphasis = (variant: TomuiButtonVariant): boolean =>
  variant === "primary" || variant === "contrast" || variant === "destructive";

/** Colour-mix vars for emphasis variants. Undefined for the others. */
function emphasisStyle(variant: TomuiButtonVariant): Record<string, string> | undefined {
  const isContrast = variant === "primary" || variant === "contrast";
  const token = isContrast
    ? colors["--color-tomui-contrast"]
    : variant === "destructive"
      ? colors["--color-tomui-danger"]
      : undefined;
  if (token === undefined) return undefined;
  if (isContrast) {
    return customProperties({
      [buttonEmphasisVars.ring]: "color-mix(in oklch, " + token + ", black 10%)",
      [buttonEmphasisVars.bg]: token,
      [buttonEmphasisVars.gradientStart]: "color-mix(in oklch, " + token + ", white 22%)",
      [buttonEmphasisVars.gradientEnd]: token,
    });
  }
  return customProperties({
    [buttonEmphasisVars.ring]: "color-mix(in oklch, " + token + ", black 10%)",
    [buttonEmphasisVars.bg]: "color-mix(in oklch, " + token + ", white 30%)",
    [buttonEmphasisVars.gradientStart]: "color-mix(in oklch, " + token + ", white 15%)",
    [buttonEmphasisVars.gradientEnd]: token,
  });
}

/**
 * Shared button styling, so primitives such as Dialog.Close and Popover.Trigger
 * can adopt button appearance without rendering a Button.
 */
export function buttonVariants(props: {
  variant?: TomuiButtonVariant;
  size?: TomuiButtonSize;
  form?: TomuiButtonForm;
}): stylex.StyleXStyles[] {
  const merged = merge(TOMUI_BUTTON_DEFAULT_VARIANTS, props);
  return [
    styles.base,
    // Size before form: the form rules set border-radius for `circle`, and
    // applying them after size would let the size radius win.
    sizeStyles[merged.size],
    formStyles[merged.form],
    variantStyles[merged.variant],
    styles.focusRing,
  ];
}

export type ButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "title" | "type"
> & {
  children?: JSX.Element;
  form?: TomuiButtonForm;
  size?: TomuiButtonSize;
  variant?: TomuiButtonVariant;
  icon?: JSX.Element;
  loading?: boolean;
  title?: string | undefined;
  type?: "button" | "submit" | "reset" | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  /**
   * Extra custom properties set on the element. Callers that compose Button
   * (such as Banner.Action) pass their own accent here rather than through
   * `style`, which only carries compiled StyleX styles.
   */
  cssVars?: Record<string, string>;
};

export function Button(props: ButtonProps) {
  const merged = merge(TOMUI_BUTTON_DEFAULT_VARIANTS, props);
  const rest = omit(
    merged,
    "children",
    "disabled",
    "loading",
    "form",
    "size",
    "variant",
    "cssVars",
    "icon",
    "style",
    "title",
    "type",
  );
  const isDisabled = (): boolean => Boolean(merged.disabled) || Boolean(merged.loading);
  /** Emphasis vars for this variant, plus any the caller supplied. */
  const inlineVars = () => ({
    ...emphasisStyle(merged.variant),
    ...merged.cssVars,
  });
  const attrs = () =>
    stylex.attrs(
      ...buttonVariants(merged),
      isCompactForm(merged.form) ? compactStyles[merged.size] : undefined,
      merged.style,
    );
  const iconNode = (): JSX.Element => {
    if (merged.loading) return <Loader size={merged.size === "lg" ? 16 : 14} />;
    return merged.icon;
  };
  return (
    <button
      data-tomui-component="Button"
      {...attrs()}
      style={inlineVars()}
      disabled={isDisabled()}
      type={merged.type ?? "button"}
      title={merged.title}
      {...rest}
    >
      <Show
        when={hasEmphasis(merged.variant)}
        fallback={
          <>
            {iconNode()}
            <Show when={merged.children}>
              {(kids) => <span {...stylex.attrs(styles.content)}>{kids()}</span>}
            </Show>
          </>
        }
      >
        <span {...stylex.attrs(styles.overlay)} />
        <span {...stylex.attrs(styles.content)}>
          {iconNode()}
          <Show when={merged.children}>
            {(kids) => <span {...stylex.attrs(layout.contents)}>{kids()}</span>}
          </Show>
        </span>
      </Show>
    </button>
  );
}

export type LinkButtonProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "style"> & {
  children?: JSX.Element;
  disabled?: boolean;
  icon?: JSX.Element;
  external?: boolean;
  form?: TomuiButtonForm;
  size?: TomuiButtonSize;
  variant?: TomuiButtonVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  /** Extra custom properties set on the element. */
  cssVars?: Record<string, string>;
};

export function LinkButton(props: LinkButtonProps) {
  const merged = merge(
    {
      form: "base" as TomuiButtonForm,
      size: "base" as TomuiButtonSize,
      variant: "ghost" as TomuiButtonVariant,
    },
    props,
  );
  const rest = omit(
    merged,
    "children",
    "disabled",
    "external",
    "form",
    "size",
    "variant",
    "icon",
    "style",
    "cssVars",
  );
  const inlineVars = () => ({
    ...emphasisStyle(merged.variant),
    ...merged.cssVars,
  });
  return (
    <Show
      when={merged.disabled}
      fallback={
        <a
          data-tomui-component="LinkButton"
          {...stylex.attrs(
            ...buttonVariants(merged),
            styles.noUnderline,
            select.text,
            merged.style,
          )}
          style={inlineVars()}
          target={merged.external ? "_blank" : undefined}
          rel={merged.external ? "noopener noreferrer" : undefined}
          {...rest}
        >
          {merged.icon}
          {merged.children}
        </a>
      }
    >
      <button
        data-tomui-component="LinkButton"
        {...stylex.attrs(...buttonVariants(merged), select.text, merged.style)}
        disabled
      >
        {merged.icon}
        {merged.children}
      </button>
    </Show>
  );
}

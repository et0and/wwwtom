import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { colors } from "../../styles/colors.stylex";
import { cursor, layout, radius, select, weight } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeXs } from "../../styles/typography.stylex";
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
  | "outline";

const disabledBase = {
  backgroundColor: "color-mix(in srgb, " + colors["--color-tomui-base"] + " 50%, transparent)",
  color: "color-mix(in srgb, " + textColors["--text-color-tomui-default"] + " 70%, transparent)",
};

const disabledDanger = {
  backgroundColor: "color-mix(in srgb, " + colors["--color-tomui-base"] + " 50%, transparent)",
  color: "color-mix(in srgb, " + textColors["--text-color-tomui-danger"] + " 70%, transparent)",
};

const styles = stylex.create({
  base: {
    position: "relative",
    display: "flex",
    width: "max-content",
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    fontFamily: "inherit",
    fontWeight: weight.medium,
    userSelect: select.none.userSelect,
    cursor: cursor.pointer.cursor,
    outlineWidth: 0,
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
    borderRadius: radius.full.borderRadius,
  },

  // Sizes
  sizeXs: {
    height: "1.25rem",
    gap: layout.gap1.gap,
    borderRadius: radius.sm.borderRadius,
    paddingInline: "0.375rem",
    fontSize: fontSizeXs.fontSize,
  },
  sizeSm: {
    height: "1.625rem",
    gap: layout.gap1.gap,
    borderRadius: radius.md.borderRadius,
    paddingInline: "0.5rem",
    fontSize: fontSizeXs.fontSize,
  },
  sizeBase: {
    height: "2.25rem",
    gap: layout.gap1_5.gap,
    borderRadius: radius.lg.borderRadius,
    paddingInline: "0.75rem",
    fontSize: fontSizeBase.fontSize,
  },
  sizeLg: {
    height: "2.5rem",
    gap: layout.gap2.gap,
    borderRadius: radius.lg.borderRadius,
    paddingInline: "1rem",
    fontSize: fontSizeBase.fontSize,
  },

  // Square extents used when the form is square or circle.
  compactXs: { width: "0.875rem", height: "0.875rem" },
  compactSm: { width: "1.625rem", height: "1.625rem" },
  compactBase: { width: "2.25rem", height: "2.25rem" },
  compactLg: { width: "2.5rem", height: "2.5rem" },

  // Emphasis variants. primary and destructive differ only in the inline accent
  // vars, so they deliberately share one rule.
  emphasis: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: buttonEmphasisVars.bg,
    color: "#fff",
    boxShadow: "0 0 0 1px " + buttonEmphasisVars.ring,
    opacity: { default: 1, ":disabled": 0.5 },
  },
  secondary: {
    backgroundColor: colors["--color-tomui-base"],
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
    ":disabled": disabledBase,
  },
  "secondary-destructive": {
    backgroundColor: colors["--color-tomui-base"],
    color: textColors["--text-color-tomui-danger"],
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"],
    ":hover": { color: textColors["--text-color-tomui-danger"] },
    ":disabled": disabledDanger,
  },
  ghost: {
    color: textColors["--text-color-tomui-default"],
    backgroundColor: "inherit",
    boxShadow: "none",
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
  },
  outline: {
    backgroundColor: "transparent",
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"],
    ":hover": {
      color: textColors["--text-color-tomui-strong"],
      boxShadow:
        "0 0 0 1px color-mix(in srgb, " + colors["--color-tomui-focus"] + " 25%, transparent)",
    },
  },

  // Focus ring. Overrides the variant box shadow, so it is applied last.
  focusRing: {
    boxShadow: {
      default: "0 0 0 1px " + colors["--color-tomui-line"],
      ":focus":
        "0 0 0 1px color-mix(in srgb, " + colors["--color-tomui-focus"] + " 50%, transparent)",
      ":focus-visible": "0 0 0 2px " + colors["--color-tomui-brand"],
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
    boxShadow: "inset 0 1px 0 0 " + buttonEmphasisVars.bg,
  },
  content: { position: "relative", display: "flex", alignItems: "center", gap: layout.gap1.gap },
  dimmed: { opacity: 0.5 },
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
  // primary and destructive share one rule; the accent vars set inline are what
  // actually differ between them.
  primary: styles.emphasis,
  secondary: styles.secondary,
  ghost: styles.ghost,
  destructive: styles.emphasis,
  "secondary-destructive": styles["secondary-destructive"],
  outline: styles.outline,
} as const satisfies Record<TomuiButtonVariant, stylex.StyleXStyles>;

const isCompactForm = (form: TomuiButtonForm): boolean => form === "square" || form === "circle";

const hasEmphasis = (variant: TomuiButtonVariant): boolean =>
  variant === "primary" || variant === "destructive";

/** Colour-mix vars for emphasis variants. Undefined for the others. */
function emphasisStyle(variant: TomuiButtonVariant): Record<string, string> | undefined {
  const token =
    variant === "primary"
      ? colors["--color-tomui-brand"]
      : variant === "destructive"
        ? colors["--color-tomui-danger"]
        : undefined;
  if (token === undefined) return undefined;
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
      isDisabled() ? styles.dimmed : undefined,
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
        {...stylex.attrs(...buttonVariants(merged), styles.dimmed, select.text, merged.style)}
        disabled
      >
        {merged.icon}
        {merged.children}
      </button>
    </Show>
  );
}

import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { colors } from "../../styles/colors.stylex";
import { cursor, layout, radius, select, spacing } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeXs } from "../../styles/typography.stylex";
import { customProperties } from "../../utils/stylex-vars";
import { buttonEmphasisVars, buttonGlassVars } from "./button-vars.stylex";
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
  | "glass";

/** Matches the TomUI switch; the press scale is the only motion in the variant. */
const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/**
 * `glass` sits on a translucent fill, so its depth is a shadow stack that the
 * generic focus ring must not overwrite: for a glass button the ring is one of
 * these three values, not the plain 1px line. Highlight, hairline, and drop are
 * restated together so every interaction state keeps the same face.
 */
const glassFace = buttonGlassVars.sheen + ", " + buttonGlassVars.surface;
const glassFaceHover = buttonGlassVars.sheen + ", " + buttonGlassVars.surfaceHover;
const glassDepth =
  "inset 0 1px 0 0 " +
  buttonGlassVars.hood +
  ", inset 0 0 0 1px " +
  buttonGlassVars.ring +
  ", 0 1px 2px " +
  buttonGlassVars.drop;
const glassDepthFocused =
  "inset 0 1px 0 0 " +
  buttonGlassVars.hood +
  ", inset 0 0 0 1px color-mix(in srgb, " +
  colors["--color-tomui-focus"] +
  " 50%, transparent)" +
  ", 0 1px 2px " +
  buttonGlassVars.drop;
const glassDepthFocusVisible =
  "inset 0 1px 0 0 " + buttonGlassVars.hood + ", 0 0 0 2px " + colors["--color-tomui-brand"];

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
    fontWeight: 500,
    userSelect: select.none,
    cursor: cursor.pointer,
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
    borderRadius: radius.full,
  },

  // Sizes
  sizeXs: {
    height: "1.25rem",
    gap: spacing.px1,
    borderRadius: radius.sm,
    paddingInline: "0.375rem",
    fontSize: fontSizeXs.fontSize,
  },
  sizeSm: {
    height: "1.625rem",
    gap: spacing.px1,
    borderRadius: radius.md,
    paddingInline: "0.5rem",
    fontSize: fontSizeXs.fontSize,
  },
  sizeBase: {
    height: "2.25rem",
    gap: spacing.px1_5,
    borderRadius: radius.lg,
    paddingInline: "0.75rem",
    fontSize: fontSizeBase.fontSize,
  },
  sizeLg: {
    height: "2.5rem",
    gap: spacing.px2,
    borderRadius: radius.lg,
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
  /**
   * Translucent surface lit from the top left. The fill is a gradient rather
   * than a colour, so the top edge reads brighter than the bottom, and a sheen
   * layer sits over it at 160deg. Pressing scales the button instead of
   * shifting colour, so the feedback is felt rather than seen — the hover fill
   * swaps with no transition, as everywhere else in TomUI.
   */
  glass: {
    position: "relative",
    color: textColors["--text-color-tomui-default"],
    backgroundImage: glassFace,
    backdropFilter: "blur(12px) saturate(180%)",
    boxShadow: {
      default: glassDepth,
      ":focus": glassDepthFocused,
      ":focus-visible": glassDepthFocusVisible,
    },
    transitionProperty: "transform",
    transitionDuration: "120ms",
    transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
    ":hover": { backgroundImage: glassFaceHover },
    ":active": { transform: "scale(0.97)" },
    [REDUCED_MOTION]: { transitionDuration: "0s" },
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
  content: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: spacing.px1,
  },
  dimmed: { opacity: 0.5 },
  /** LinkButton: links select their text, buttons do not. */
  linkButton: { userSelect: select.text, textDecorationLine: "none" },
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
  glass: styles.glass,
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
    // `glass` carries its own ring inside its shadow stack, so the generic
    // focus ring would flatten the surface back to a plain outline.
    ...(merged.variant === "glass" ? [] : [styles.focusRing]),
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
          {...stylex.attrs(...buttonVariants(merged), styles.linkButton, merged.style)}
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
        {...stylex.attrs(...buttonVariants(merged), styles.dimmed, styles.linkButton, merged.style)}
        disabled
      >
        {merged.icon}
        {merged.children}
      </button>
    </Show>
  );
}

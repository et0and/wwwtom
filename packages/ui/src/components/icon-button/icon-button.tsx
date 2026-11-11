import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";

export const TOMUI_ICON_BUTTON_DEFAULT_VARIANTS = {
  size: "normal",
  variant: "neutral",
} as const;

export type TomuiIconButtonSize = "small" | "normal" | "large";
export type TomuiIconButtonVariant = "neutral" | "contrast" | "submit" | "ghost" | "ghost-muted";

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: radius.md,
    padding: 0,
    color: textColors["--text-color-tomui-default"],
    userSelect: "none",
    cursor: "pointer",
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "2.5px",
    transitionProperty: "none",
    ":focus-visible": {
      outlineWidth: "2px",
      outlineColor: colors["--color-tomui-focus"],
    },
    ":disabled": { opacity: 0.5, cursor: "not-allowed" },
  },
  sizeSmall: { width: "1.25rem", height: "1.25rem", borderRadius: radius.sm },
  sizeNormal: { width: "1.5rem", height: "1.5rem" },
  sizeLarge: { width: "1.75rem", height: "1.75rem" },
  neutral: {
    backgroundColor: colors["--color-tomui-button-neutral"],
    boxShadow: elevation["--elevation-tomui-button-neutral"],
    ":hover": { backgroundColor: colors["--color-tomui-tint"] },
  },
  contrast: {
    backgroundImage:
      "linear-gradient(180deg, " +
      colors["--color-tomui-sheen-top"] +
      " 0%, " +
      colors["--color-tomui-sheen-bottom"] +
      " 100%)",
    backgroundColor: colors["--color-tomui-button-contrast"],
    color: textColors["--text-color-tomui-inverse"],
    boxShadow: elevation["--elevation-tomui-button-contrast"],
    ":hover": { opacity: 0.9 },
    ":disabled": { opacity: 0.4 },
  },
  ghost: {
    backgroundColor: "transparent",
    ":hover": { backgroundColor: colors["--color-tomui-overlay-hover"] },
    ":active": { backgroundColor: colors["--color-tomui-overlay-pressed"] },
  },
  ghostMuted: {
    backgroundColor: "transparent",
    color: textColors["--text-color-tomui-subtle"],
    ":hover": {
      backgroundColor: colors["--color-tomui-overlay-hover"],
      color: textColors["--text-color-tomui-default"],
    },
    ":active": { backgroundColor: colors["--color-tomui-overlay-pressed"] },
  },
});

const sizeStyles = {
  small: styles.sizeSmall,
  normal: styles.sizeNormal,
  large: styles.sizeLarge,
} as const satisfies Record<TomuiIconButtonSize, stylex.StyleXStyles>;

const variantStyles = {
  neutral: styles.neutral,
  contrast: styles.contrast,
  submit: styles.contrast,
  ghost: styles.ghost,
  "ghost-muted": styles.ghostMuted,
} as const satisfies Record<TomuiIconButtonVariant, stylex.StyleXStyles>;

export type IconButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "children"
> & {
  /** The glyph or icon element. */
  icon: JSX.Element;
  /** Accessible name. Icon-only controls must have one. */
  label: string;
  size?: TomuiIconButtonSize;
  variant?: TomuiIconButtonVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function IconButton(props: IconButtonProps): JSX.Element {
  const merged = merge(TOMUI_ICON_BUTTON_DEFAULT_VARIANTS, props);
  const rest = omit(merged, "icon", "label", "size", "variant", "style", "type");
  return (
    <button
      {...rest}
      type={merged.type ?? "button"}
      aria-label={merged.label}
      data-tomui-component="IconButton"
      {...stylex.attrs(
        styles.base,
        sizeStyles[merged.size],
        variantStyles[merged.variant],
        merged.style,
      )}
    >
      <Show when={merged.icon}>{(icon) => icon()}</Show>
    </button>
  );
}

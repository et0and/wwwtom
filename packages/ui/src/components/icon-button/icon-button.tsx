import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";

export const MIDORI_ICON_BUTTON_DEFAULT_VARIANTS = {
  size: "normal",
  variant: "neutral",
} as const;

export type MidoriIconButtonSize = "small" | "normal" | "large";
export type MidoriIconButtonVariant = "neutral" | "contrast" | "submit" | "ghost" | "ghost-muted";

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: radius.md,
    padding: 0,
    color: textColors["--text-color-midori-default"],
    userSelect: "none",
    cursor: "pointer",
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "2.5px",
    transitionProperty: "none",
    ":focus-visible": {
      outlineWidth: "2px",
      outlineColor: colors["--color-midori-focus"],
    },
    ":disabled": { opacity: 0.5, cursor: "not-allowed" },
  },
  sizeSmall: { width: "1.25rem", height: "1.25rem", borderRadius: radius.sm },
  sizeNormal: { width: "1.5rem", height: "1.5rem" },
  sizeLarge: { width: "1.75rem", height: "1.75rem" },
  neutral: {
    backgroundColor: colors["--color-midori-button-neutral"],
    boxShadow: elevation["--elevation-midori-button-neutral"],
    ":hover": { backgroundColor: colors["--color-midori-tint"] },
  },
  contrast: {
    backgroundImage:
      "linear-gradient(180deg, " +
      colors["--color-midori-sheen-top"] +
      " 0%, " +
      colors["--color-midori-sheen-bottom"] +
      " 100%)",
    backgroundColor: colors["--color-midori-button-contrast"],
    color: textColors["--text-color-midori-inverse"],
    boxShadow: elevation["--elevation-midori-button-contrast"],
    ":hover": { opacity: 0.9 },
    ":disabled": { opacity: 0.4 },
  },
  ghost: {
    backgroundColor: "transparent",
    ":hover": { backgroundColor: colors["--color-midori-overlay-hover"] },
    ":active": { backgroundColor: colors["--color-midori-overlay-pressed"] },
  },
  ghostMuted: {
    backgroundColor: "transparent",
    color: textColors["--text-color-midori-subtle"],
    ":hover": {
      backgroundColor: colors["--color-midori-overlay-hover"],
      color: textColors["--text-color-midori-default"],
    },
    ":active": { backgroundColor: colors["--color-midori-overlay-pressed"] },
  },
});

const sizeStyles = {
  small: styles.sizeSmall,
  normal: styles.sizeNormal,
  large: styles.sizeLarge,
} as const satisfies Record<MidoriIconButtonSize, stylex.StyleXStyles>;

const variantStyles = {
  neutral: styles.neutral,
  contrast: styles.contrast,
  submit: styles.contrast,
  ghost: styles.ghost,
  "ghost-muted": styles.ghostMuted,
} as const satisfies Record<MidoriIconButtonVariant, stylex.StyleXStyles>;

export type IconButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "children"
> & {
  /** The glyph or icon element. */
  icon: JSX.Element;
  /** Accessible name. Icon-only controls must have one. */
  label: string;
  size?: MidoriIconButtonSize;
  variant?: MidoriIconButtonVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function IconButton(props: IconButtonProps): JSX.Element {
  const merged = merge(MIDORI_ICON_BUTTON_DEFAULT_VARIANTS, props);
  const rest = omit(merged, "icon", "label", "size", "variant", "style", "type");
  return (
    <button
      {...rest}
      type={merged.type ?? "button"}
      aria-label={merged.label}
      data-midori-component="IconButton"
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

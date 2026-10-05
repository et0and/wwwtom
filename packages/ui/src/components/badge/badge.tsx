import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_BADGE_DEFAULT_VARIANTS = {
  variant: "primary",
  appearance: "filled",
  dotColor: "none",
} as const;

export type TomuiBadgeVariant =
  | "primary"
  | "secondary"
  | "error"
  | "warning"
  | "success"
  | "info"
  | "beta"
  | "outline"
  | "red"
  | "green"
  | "neutral"
  | "orange"
  | "purple"
  | "teal"
  | "teal-subtle"
  | "blue";
export type TomuiBadgeAppearance = "filled" | "dot";

const hairlineColor = colors["--color-tomui-hairline"];
const white = colors["--color-white"];
const black = colors["--color-black"];

const styles = stylex.create({
  base: {
    display: "inline-flex",
    width: "fit-content",
    flexShrink: 0,
    alignItems: "center",
    justifySelf: "start",
    gap: "0.25rem",
    borderRadius: radius.full.borderRadius,
    padding: "0.125rem 0.5rem",
    fontSize: "0.75rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  /** An icon needs a little more room than a text-only badge. */
  withIcon: { paddingInlineStart: "0.375rem" },
  primary: {
    backgroundColor: colors["--color-tomui-badge-inverted"],
    color: textColors["--text-color-tomui-badge-inverted"],
  },
  secondary: {
    backgroundColor: colors["--color-tomui-fill"],
    color: textColors["--text-color-tomui-badge-neutral-subtle"],
  },
  error: {
    backgroundColor: colors["--color-tomui-danger-tint"],
    color: textColors["--text-color-tomui-danger"],
  },
  warning: {
    backgroundColor: colors["--color-tomui-warning-tint"],
    color: textColors["--text-color-tomui-warning"],
  },
  success: {
    backgroundColor: colors["--color-tomui-success-tint"],
    color: textColors["--text-color-tomui-success"],
  },
  info: {
    backgroundColor: colors["--color-tomui-info-tint"],
    color: textColors["--text-color-tomui-info"],
  },
  beta: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors["--color-tomui-brand"],
    backgroundColor: "transparent",
    color: textColors["--text-color-tomui-link"],
  },
  outline: {
    borderWidth: 1,
    borderColor: colors["--color-tomui-fill"],
    backgroundColor: colors["--color-tomui-base"],
    color: textColors["--text-color-tomui-default"],
  },
  red: { backgroundColor: colors["--color-tomui-badge-red"], color: white },
  green: { backgroundColor: colors["--color-tomui-badge-green"], color: white },
  neutral: { backgroundColor: colors["--color-tomui-badge-neutral"], color: white },
  orange: { backgroundColor: colors["--color-tomui-badge-orange"], color: black },
  purple: { backgroundColor: colors["--color-tomui-badge-purple"], color: white },
  teal: { backgroundColor: colors["--color-tomui-badge-teal"], color: white },
  tealSubtle: {
    backgroundColor: colors["--color-tomui-fill"],
    color: textColors["--text-color-tomui-badge-teal-subtle"],
  },
  blue: { backgroundColor: colors["--color-tomui-badge-blue"], color: white },
  dot: {
    gap: "0.375rem",
    backgroundColor: "transparent",
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 0 0 1px " + hairlineColor,
  },
  dotMark: {
    width: "0.4375rem",
    height: "0.4375rem",
    flexShrink: 0,
    borderRadius: radius.full.borderRadius,
  },
  dotSuccess: { backgroundColor: colors["--color-tomui-success"] },
  dotWarning: { backgroundColor: colors["--color-tomui-badge-orange"] },
  dotError: { backgroundColor: colors["--color-tomui-badge-red"] },
  dotNeutral: { backgroundColor: colors["--color-tomui-badge-neutral"] },
  iconWrapper: {
    display: "flex",
    width: "0.75rem",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});

const variantStyles = {
  primary: styles.primary,
  secondary: styles.secondary,
  error: styles.error,
  warning: styles.warning,
  success: styles.success,
  info: styles.info,
  beta: styles.beta,
  outline: styles.outline,
  red: styles.red,
  green: styles.green,
  neutral: styles.neutral,
  orange: styles.orange,
  purple: styles.purple,
  teal: styles.teal,
  "teal-subtle": styles.tealSubtle,
  blue: styles.blue,
} as const satisfies Record<TomuiBadgeVariant, stylex.StyleXStyles>;

/**
 * The dot colour is keyed by variant, so only these variants show a dot. This
 * matches the old lookup, which passed the variant straight into the dot map.
 */
const dotStyles = {
  success: styles.dotSuccess,
  warning: styles.dotWarning,
  error: styles.dotError,
  neutral: styles.dotNeutral,
} as const;

export type BadgeDotColor = keyof typeof dotStyles;

export function badgeVariants(props: {
  variant?: TomuiBadgeVariant;
  appearance?: TomuiBadgeAppearance;
}) {
  const merged = merge(TOMUI_BADGE_DEFAULT_VARIANTS, props);
  const isDot = merged.appearance === "dot";
  return [
    styles.base,
    // The dot appearance replaces the variant colours.
    isDot ? undefined : variantStyles[merged.variant],
    isDot ? styles.dot : undefined,
  ].filter((style) => style !== undefined);
}

export type BadgeProps = {
  variant?: TomuiBadgeVariant;
  appearance?: TomuiBadgeAppearance;
  icon?: JSX.Element;
  children: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Badge(props: BadgeProps) {
  const merged = merge(TOMUI_BADGE_DEFAULT_VARIANTS, props);
  const rest = omit(merged, "variant", "appearance", "style", "icon", "children");
  const isDot = merged.appearance === "dot";
  const dotColor = (): stylex.StyleXStyles | undefined =>
    isDot ? dotStyles[merged.variant as BadgeDotColor] : undefined;
  return (
    <span
      data-tomui-component="Badge"
      {...stylex.attrs(
        ...badgeVariants({ variant: merged.variant, appearance: merged.appearance }),
        merged.icon === undefined ? undefined : styles.withIcon,
        merged.style,
      )}
      {...rest}
    >
      <Show when={dotColor()}>
        {(color) => <span aria-hidden="true" {...stylex.attrs(styles.dotMark, color())} />}
      </Show>
      <Show when={merged.icon}>
        {(icon) => (
          <span data-slot="badge-icon" {...stylex.attrs(styles.iconWrapper)}>
            {icon()}
          </span>
        )}
      </Show>
      {merged.children}
    </span>
  );
}

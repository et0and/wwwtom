import { createContext, merge, omit, Show, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { Button } from "../button/button";
import { customProperties } from "../../utils/stylex-vars";
import { bannerAccentVars } from "./banner-vars.stylex";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
import type { TomuiBannerVariant } from "./banner";

/**
 * Visual variant for a `Banner.Action`, aligned with `Button`'s `variant` naming.
 * - `"primary"` — filled accent gradient for the main action.
 * - `"secondary"` — transparent with an accent-hued outline (same hue as the banner).
 * - `"ghost"` — text-only accent action with a faint accent-tinted hover.
 */
export type BannerActionVariant = "primary" | "secondary" | "ghost";

/**
 * Size of a `Banner.Action`, matching the equivalent `Button` size specs.
 * - `"xs"` — extra small for dense/compact banners.
 * - `"sm"` — small (default), the standard banner CTA size.
 */
export type BannerActionSize = "xs" | "sm";

/** Value shared from the `Banner` root to its `Banner.Action` children. */
export interface BannerActionContextValue {
  /** Banner variant, used to pick the matching accent color. */
  variant: TomuiBannerVariant;
  /** Action size derived from the banner's own size. */
  size: BannerActionSize;
}

/**
 * Propagates the banner's variant and action size to `Banner.Action`
 * children so each CTA can self-style without prop drilling.
 *
 * The `Banner` root always overrides these defaults via a Provider; the literals
 * mirror a default, base-size banner (kept as literals to avoid a runtime import
 * cycle with `banner.tsx`).
 */
export const BannerActionContext = createContext<BannerActionContextValue>({
  variant: "default",
  size: "sm",
});

/**
 * The accent colour per banner variant. It is read from context at runtime, so
 * it cannot live in a static StyleX rule; the styles below reference the
 * `--banner-accent` custom property instead, and this value is set inline.
 */
const BANNER_ACTION_ACCENTS = {
  default: colors["--color-tomui-info"],
  alert: colors["--color-tomui-warning"],
  error: colors["--color-tomui-danger"],
  secondary: colors["--color-tomui-focus"],
} satisfies Record<TomuiBannerVariant, string>;

const styles = stylex.create({
  secondary: {
    color: "inherit",
    boxShadow: "0 0 0 1px color-mix(in srgb, " + bannerAccentVars.accent + " 50%, transparent)",
    fill: bannerAccentVars.accent,
    ":hover": {
      color: "inherit",
      boxShadow: "0 0 0 1px color-mix(in srgb, " + bannerAccentVars.accent + " 50%, transparent)",
      backgroundColor: "color-mix(in srgb, " + bannerAccentVars.accent + " 10%, transparent)",
    },
  },
  ghost: {
    color: "inherit",
    fill: bannerAccentVars.accent,
    ":hover": {
      backgroundColor: "color-mix(in srgb, " + bannerAccentVars.accent + " 10%, transparent)",
    },
  },
  secondaryMuted: {
    color: "inherit",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, " + colors["--color-tomui-focus"] + " 20%, transparent)",
    fill: textColors["--text-color-tomui-subtle"],
    ":hover": {
      color: "inherit",
      boxShadow:
        "0 0 0 1px color-mix(in srgb, " + colors["--color-tomui-focus"] + " 20%, transparent)",
      backgroundColor:
        "color-mix(in srgb, " + colors["--color-tomui-contrast"] + " 10%, transparent)",
    },
  },
  ghostMuted: {
    color: "inherit",
    fill: textColors["--text-color-tomui-subtle"],
    ":hover": {
      backgroundColor:
        "color-mix(in srgb, " + colors["--color-tomui-contrast"] + " 10%, transparent)",
    },
  },
});

/** Props for {@link BannerAction}. */
export type BannerActionProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "form" | "ref" | "style" | "title" | "type"
> & {
  children?: JSX.Element;
  icon?: JSX.Element;
  /**
   * Visual variant of the CTA, aligned with `Button`'s `variant` naming.
   * - `"primary"` — filled accent gradient for the main action (default).
   * - `"secondary"` — transparent with an accent-hued outline matching the banner.
   * - `"ghost"` — text-only accent action with a faint accent-tinted hover.
   * @default "primary"
   */
  variant?: BannerActionVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  title?: string | undefined;
  type?: "button" | "submit" | "reset" | undefined;
};

/**
 * A banner CTA built on the `Button`. It inherits Button's sizing, interaction,
 * loading, and accessibility behavior while supplying banner-specific accent styles.
 *
 * @example
 * ```tsx
 * <Banner.Action onClick={retry}>Retry</Banner.Action>
 * <Banner.Action variant="ghost" icon={<XIcon />} aria-label="Dismiss" />
 * ```
 */
export function BannerAction(props: BannerActionProps): JSX.Element {
  const merged = merge({ variant: "primary" as BannerActionVariant, type: "button" }, props);
  const rest = omit(merged, "children", "icon", "style", "title", "type", "variant");
  const banner = useContext(BannerActionContext);
  const buttonVariant = (): "primary" | "outline" | "ghost" =>
    merged.variant === "secondary" ? "outline" : merged.variant;
  const isMuted = (): boolean => banner.variant === "secondary";
  const accentStyle = (): Record<string, string> =>
    customProperties({ [bannerAccentVars.accent]: BANNER_ACTION_ACCENTS[banner.variant] });
  const variantStyles = () => {
    if (merged.variant === "secondary") {
      return isMuted() ? styles.secondaryMuted : styles.secondary;
    }
    return isMuted() ? styles.ghostMuted : styles.ghost;
  };
  return (
    <Button
      variant={buttonVariant()}
      size={banner.size}
      style={merged.variant === "primary" ? merged.style : [variantStyles(), merged.style]}
      cssVars={accentStyle()}
      title={merged.title}
      type={merged.type === "submit" || merged.type === "reset" ? merged.type : "button"}
      {...rest}
    >
      <Show when={merged.icon}>{merged.icon}</Show>
      {merged.children}
    </Button>
  );
}

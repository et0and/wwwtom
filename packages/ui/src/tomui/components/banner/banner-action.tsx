import { createContext, merge, omit, Show, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button/button";
import { cn } from "../../utils/cn";
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

/** Per-banner-variant colors passed to the underlying `Button`. */
const BANNER_ACTION_ACCENTS = {
  default: {
    accent: "var(--color-tomui-info)",
    secondary:
      "text-inherit ring-tomui-info/50 fill-tomui-info hover:!text-inherit hover:!ring-tomui-info/50 hover:bg-tomui-info/10",
    ghost: "text-inherit fill-tomui-info hover:bg-tomui-info/10",
  },
  alert: {
    accent: "var(--color-tomui-warning)",
    secondary:
      "text-inherit ring-tomui-warning/50 fill-tomui-warning hover:!text-inherit hover:!ring-tomui-warning/50 hover:bg-tomui-warning/10",
    ghost: "text-inherit fill-tomui-warning hover:bg-tomui-warning/10",
  },
  error: {
    accent: "var(--color-tomui-danger)",
    secondary:
      "text-inherit ring-tomui-danger/50 fill-tomui-danger hover:!text-inherit hover:!ring-tomui-danger/50 hover:bg-tomui-danger/10",
    ghost: "text-inherit fill-tomui-danger hover:bg-tomui-danger/10",
  },
  secondary: {
    accent: "var(--color-neutral-700, oklch(37.1% 0 0))",
    secondary:
      "text-inherit ring-tomui-focus/20 fill-tomui-subtle hover:!text-inherit hover:!ring-tomui-focus/20 hover:bg-tomui-contrast/10",
    ghost: "text-inherit fill-tomui-subtle hover:bg-tomui-contrast/10",
  },
} satisfies Record<TomuiBannerVariant, { accent: string; secondary: string; ghost: string }>;

function bannerActionAccentVars(accent: string): JSX.CSSProperties {
  return {
    "--tomui-button-emphasis-ring": `color-mix(in oklch, ${accent}, black 10%)`,
    "--tomui-button-emphasis-bg": `color-mix(in oklch, ${accent}, white 30%)`,
    "--tomui-button-emphasis-gradient-start": `color-mix(in oklch, ${accent}, white 15%)`,
    "--tomui-button-emphasis-gradient-end": accent,
  } as JSX.CSSProperties;
}

/** Props for {@link BannerAction}. */
export type BannerActionProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "ref" | "style" | "title" | "type"
> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
  /**
   * Visual variant of the CTA, aligned with `Button`'s `variant` naming.
   * - `"primary"` — filled accent gradient for the main action (default).
   * - `"secondary"` — transparent with an accent-hued outline matching the banner.
   * - `"ghost"` — text-only accent action with a faint accent-tinted hover.
   * @default "primary"
   */
  variant?: BannerActionVariant;
  style?: JSX.CSSProperties | undefined;
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
  const rest = omit(
    merged,
    "children",
    "class",
    "form",
    "icon",
    "style",
    "title",
    "type",
    "variant",
  );
  const banner = useContext(BannerActionContext);
  const styles = (): { accent: string; secondary: string; ghost: string } =>
    BANNER_ACTION_ACCENTS[banner.variant];
  const buttonVariant = (): "primary" | "outline" | "ghost" =>
    merged.variant === "secondary" ? "outline" : merged.variant;
  const baseStyle = (): JSX.CSSProperties | undefined => merged.style;
  const style = (): JSX.CSSProperties | undefined => {
    if (merged.variant !== "primary") return baseStyle();
    return { ...bannerActionAccentVars(styles().accent), ...baseStyle() };
  };
  return (
    <Button
      variant={buttonVariant()}
      size={banner.size}
      class={cn(merged.variant !== "primary" ? styles()[merged.variant] : "", merged.class)}
      style={style()}
      title={merged.title}
      type={merged.type === "submit" || merged.type === "reset" ? merged.type : "button"}
      {...rest}
    >
      <Show when={merged.icon}>{merged.icon}</Show>
      {merged.children}
    </Button>
  );
}

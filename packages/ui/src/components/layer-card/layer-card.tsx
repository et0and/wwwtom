import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase } from "../../styles/typography.stylex";

const lineColor = colors["--color-tomui-line"];

const styles = stylex.create({
  surface: {
    overflow: "clip",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    boxShadow: "0 0 0 1px " + lineColor + ", 0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },
  layeredRoot: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    overflow: "clip",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-elevated"],
    boxShadow: "0 0 0 1px " + colors["--color-tomui-hairline"],
    ...fontSizeBase,
  },
  secondary: {
    marginBlock: "-0.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    backgroundColor: colors["--color-tomui-elevated"],
    padding: "1rem",
    fontWeight: 500,
    color: textColors["--text-color-tomui-subtle"],
    ...fontSizeBase,
  },
  primary: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    overflow: "clip",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    padding: "1rem",
    paddingInlineEnd: "0.75rem",
    color: "inherit",
    textDecorationLine: "none",
    boxShadow: "0 0 0 1px " + colors["--color-tomui-fill"],
  },
});

export function layerCardVariants(): stylex.StyleXStyles {
  return styles.surface;
}

/**
 * LayerCard component props.
 *
 * @example
 * ```tsx
 * <LayerCard>
 *   Get started with Tomui
 * </LayerCard>
 *
 * <LayerCard layered>
 *   <LayerCard.Secondary>Next Steps</LayerCard.Secondary>
 *   <LayerCard.Primary>Get started with Tomui</LayerCard.Primary>
 * </LayerCard>
 * ```
 */
export type LayerCardProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref" | "class" | "style"> & {
  children?: JSX.Element;
  /**
   * Render the layered card treatment (elevated container for
   * `LayerCard.Secondary` + `LayerCard.Primary` sections).
   * Tomui auto-detects section children; Solid cannot inspect
   * children types, so this is explicit.
   * @default false
   */
  layered?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  ref?: HTMLDivElement | ((element: HTMLDivElement) => void) | undefined;
};

export type LayerCardSectionProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "ref" | "class" | "style"
> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

/**
 * Card container for both simple surfaces and layered layouts.
 *
 * Render children directly for a single-surface card, or pass `layered` with
 * `LayerCard.Secondary` and `LayerCard.Primary` for the layered card treatment.
 *
 * @example
 * ```tsx
 * <LayerCard>Card content</LayerCard>
 * ```
 *
 * @example
 * ```tsx
 * <LayerCard layered>
 *   <LayerCard.Secondary>Getting Started</LayerCard.Secondary>
 *   <LayerCard.Primary>Quick start guide</LayerCard.Primary>
 * </LayerCard>
 * ```
 */
function LayerCardRoot(props: LayerCardProps): JSX.Element {
  const merged = merge({ layered: false }, props);
  const rest = omit(merged, "children", "layered", "ref", "style");
  return (
    <div
      data-tomui-component="LayerCard"
      {...stylex.attrs(merged.layered ? styles.layeredRoot : layerCardVariants(), merged.style)}
      ref={merged.ref}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

function LayerCardSecondary(props: LayerCardSectionProps): JSX.Element {
  const rest = omit(props, "children", "style");
  return (
    <div
      data-tomui-component="LayerCard.Secondary"
      {...stylex.attrs(styles.secondary, props.style)}
      {...rest}
    >
      {props.children}
    </div>
  );
}

function LayerCardPrimary(props: LayerCardSectionProps): JSX.Element {
  const rest = omit(props, "children", "style");
  return (
    <div
      data-tomui-component="LayerCard.Primary"
      {...stylex.attrs(styles.primary, props.style)}
      {...rest}
    >
      {props.children}
    </div>
  );
}

type LayerCardComponent = typeof LayerCardRoot & {
  Primary: typeof LayerCardPrimary;
  Secondary: typeof LayerCardSecondary;
};

export const LayerCard: LayerCardComponent = Object.assign(LayerCardRoot, {
  Primary: LayerCardPrimary,
  Secondary: LayerCardSecondary,
});

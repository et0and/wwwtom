import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";

/**
 * Tailwind's default breakpoints. The grid variants below carry the same
 * `md:`/`lg:`/`xl:` steps the old classes did.
 */
const MD = "@media (min-width: 768px)";
const LG = "@media (min-width: 1024px)";
const XL = "@media (min-width: 1280px)";

const styles = stylex.create({
  grid: { display: "grid" },
  twoUp: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
  sideBySide: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  twoToOne: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "2fr 1fr" },
  },
  oneToTwo: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "1fr 2fr" },
  },
  oneThreeUp: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [LG]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  },
  threeUp: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    [LG]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  },
  fourUp: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    [LG]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
    [XL]: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
  },
  sixUp: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
    [LG]: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
    [XL]: { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" },
  },
  oneTwoFourUp: {
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    [MD]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    [LG]: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
  },
  gapNone: { gap: 0 },
  gapSm: { gap: "0.75rem" },
  gapBase: {
    gap: "0.5rem",
    [MD]: { gap: "1.5rem" },
    [LG]: { gap: "2rem" },
  },
  gapLg: { gap: "2rem" },
  /** Stacks items with a divider on narrow screens; the 4up grid alone collapses to one column. */
  mobileDivider: {
    borderBlockEndWidth: "1px",
    borderBlockEndColor: colors["--color-tomui-hairline"],
    paddingBlockEnd: "2rem",
    [MD]: { borderBlockEndWidth: 0, paddingBlockEnd: 0 },
  },
});

export type TomuiGridVariant =
  | "2up"
  | "side-by-side"
  | "2-1"
  | "1-2"
  | "1-3up"
  | "3up"
  | "4up"
  | "6up"
  | "1-2-4up";
export type TomuiGridGap = "none" | "sm" | "base" | "lg";

export const TOMUI_GRID_DEFAULT_VARIANTS = {
  gap: "base",
} as const;

const variantStyles = {
  "2up": styles.twoUp,
  "side-by-side": styles.sideBySide,
  "2-1": styles.twoToOne,
  "1-2": styles.oneToTwo,
  "1-3up": styles.oneThreeUp,
  "3up": styles.threeUp,
  "4up": styles.fourUp,
  "6up": styles.sixUp,
  "1-2-4up": styles.oneTwoFourUp,
} as const satisfies Record<TomuiGridVariant, stylex.StyleXStyles>;

const gapStyles = {
  none: styles.gapNone,
  sm: styles.gapSm,
  base: styles.gapBase,
  lg: styles.gapLg,
} as const satisfies Record<TomuiGridGap, stylex.StyleXStyles>;

export function gridVariants(
  props: { variant?: TomuiGridVariant | undefined; gap?: TomuiGridGap | undefined } = {},
): stylex.StyleXStyles[] {
  const merged = merge(TOMUI_GRID_DEFAULT_VARIANTS, props);
  return [
    styles.grid,
    merged.variant ? variantStyles[merged.variant] : undefined,
    gapStyles[merged.gap],
  ].filter((style) => style !== undefined);
}

export function gridItemVariants(
  props: { variant?: TomuiGridVariant | undefined; mobileDivider?: boolean | undefined } = {},
): stylex.StyleXStyles | undefined {
  const merged = merge({}, props);
  return merged.mobileDivider && merged.variant === "4up" ? styles.mobileDivider : undefined;
}

export type GridProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "style"> & {
  children?: JSX.Element;
  columns?: number;
  gap?: TomuiGridGap;
  variant?: TomuiGridVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type GridItemProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "style"> & {
  children?: JSX.Element;
  mobileDivider?: boolean;
  variant?: TomuiGridVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Grid(props: GridProps) {
  const merged = merge({ gap: TOMUI_GRID_DEFAULT_VARIANTS.gap }, props);
  const rest = omit(merged, "children", "columns", "gap", "style", "variant");
  // The column count is an arbitrary runtime number, so it cannot compile to a
  // static StyleX rule; it stays a native inline style, like `columns` always was.
  const columnsStyle = (): JSX.CSSProperties | undefined =>
    merged.columns === undefined
      ? undefined
      : { "grid-template-columns": `repeat(${merged.columns}, minmax(0, 1fr))` };
  return (
    <div
      data-tomui-component="Grid"
      data-variant={merged.variant ?? ""}
      {...stylex.attrs(...gridVariants({ gap: merged.gap, variant: merged.variant }), merged.style)}
      style={columnsStyle()}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export function GridItem(props: GridItemProps) {
  const rest = omit(props, "children", "mobileDivider", "style", "variant");
  return (
    <div
      data-tomui-component="GridItem"
      {...stylex.attrs(
        gridItemVariants({ variant: props.variant, mobileDivider: props.mobileDivider }),
        props.style,
      )}
      {...rest}
    >
      {props.children}
    </div>
  );
}

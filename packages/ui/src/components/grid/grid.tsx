import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_GRID_VARIANTS = {
  variant: {
    "2up": {
      classes: "grid-cols-1 md:grid-cols-2",
      description:
        "Grid items stack on small screens, display side-by-side on medium screens and up",
    },
    "side-by-side": {
      classes: "grid-cols-2",
      description: "Grid items always displayed side-by-side",
    },
    "2-1": {
      classes: "grid-cols-1 md:grid-cols-[2fr_1fr]",
      description: "Two-thirds / one-third split (66%/33%) on medium screens and up",
    },
    "1-2": {
      classes: "grid-cols-1 md:grid-cols-[1fr_2fr]",
      description: "One-third / two-thirds split (33%/66%) on medium screens and up",
    },
    "1-3up": {
      classes: "grid-cols-1 lg:grid-cols-3",
      description: "Grid items stack on small screens, expand to 3 across on large screens",
    },
    "3up": {
      classes: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      description: "Grid items stack on small screens, 2 across on medium, 3 across on large",
    },
    "4up": {
      classes: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      description:
        "Grid items stack on small screens, progressively increase columns at larger breakpoints",
    },
    "6up": {
      classes: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
      description: "Grid items start at 2 across, expand to 6 across on XL",
    },
    "1-2-4up": {
      classes: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      description: "Grid items stack on small screens, 2 across on medium, 4 across on large",
    },
  },
  gap: {
    none: { classes: "gap-0", description: "No gap between grid items" },
    sm: { classes: "gap-3", description: "Small gap between grid items" },
    base: {
      classes: "gap-2 md:gap-6 lg:gap-8",
      description: "Default responsive gap between grid items",
    },
    lg: { classes: "gap-8", description: "Large gap between grid items" },
  },
} as const;

export const TOMUI_GRID_DEFAULT_VARIANTS = {
  gap: "base",
} as const;

export type TomuiGridVariant = keyof typeof TOMUI_GRID_VARIANTS.variant;
export type TomuiGridGap = keyof typeof TOMUI_GRID_VARIANTS.gap;

export type GridProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element;
  class?: string;
  columns?: number;
  gap?: TomuiGridGap;
  style?: JSX.CSSProperties;
  variant?: TomuiGridVariant;
};

export type GridItemProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
};

export function gridVariants(
  props: { variant?: TomuiGridVariant | undefined; gap?: TomuiGridGap | undefined } = {},
): string {
  const merged = merge(TOMUI_GRID_DEFAULT_VARIANTS, props);
  return cn(
    "grid",
    merged.variant && resolveVariant(TOMUI_GRID_VARIANTS.variant, merged.variant, "2up").classes,
    resolveVariant(TOMUI_GRID_VARIANTS.gap, merged.gap, TOMUI_GRID_DEFAULT_VARIANTS.gap).classes,
  );
}

export function Grid(props: GridProps) {
  const merged = merge({ gap: TOMUI_GRID_DEFAULT_VARIANTS.gap }, props);
  const rest = omit(merged, "children", "class", "columns", "gap", "style", "variant");
  const baseStyle = (): JSX.CSSProperties | undefined => merged.style;
  const style = (): JSX.CSSProperties | undefined => {
    if (merged.columns === undefined) return baseStyle();
    return { ...baseStyle(), "grid-template-columns": `repeat(${merged.columns}, minmax(0, 1fr))` };
  };
  return (
    <div
      data-tomui-component="Grid"
      data-variant={merged.variant ?? ""}
      class={cn(gridVariants({ gap: merged.gap, variant: merged.variant }), merged.class)}
      style={style()}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export function GridItem(props: GridItemProps) {
  const rest = omit(props, "children", "class");
  return (
    <div data-tomui-component="GridItem" class={cn(props.class)} {...rest}>
      {props.children}
    </div>
  );
}

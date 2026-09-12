import type { JSX } from "@solidjs/web";

/** Icon stroke style. Matches the six Phosphor weights. */
export const ICON_WEIGHTS = ["thin", "light", "regular", "bold", "fill", "duotone"] as const;

export type IconWeight = (typeof ICON_WEIGHTS)[number];

export const DEFAULT_ICON_WEIGHT: IconWeight = "regular";

/** Icon size tokens in pixels. */
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export const DEFAULT_ICON_SIZE: IconSize = "md";

/** Icon color tokens. Tomui tokens adapt to light and dark mode. */
export const ICON_COLORS = {
  current: "currentColor",
  default: "var(--text-color-tomui-default)",
  strong: "var(--text-color-tomui-strong)",
  subtle: "var(--text-color-tomui-subtle)",
  inverse: "var(--text-color-tomui-inverse)",
  brand: "var(--text-color-tomui-brand)",
  link: "var(--text-color-tomui-link)",
  info: "var(--text-color-tomui-info)",
  success: "var(--text-color-tomui-success)",
  warning: "var(--text-color-tomui-warning)",
  danger: "var(--text-color-tomui-danger)",
  white: "#ffffff",
  black: "#000000",
} as const;

export type IconColor = keyof typeof ICON_COLORS;

export const DEFAULT_ICON_COLOR: IconColor = "current";

export function iconSizePx(size: IconSize): number {
  // Fall back to the default so plain-JS callers passing an unknown
  // token still get a rendered icon instead of width={undefined}.
  return ICON_SIZES[size] ?? ICON_SIZES[DEFAULT_ICON_SIZE];
}

export function iconColorValue(color: IconColor): string {
  // Same fallback contract as iconSizePx for unknown color tokens.
  return ICON_COLORS[color] ?? ICON_COLORS[DEFAULT_ICON_COLOR];
}

/**
 * Props for every icon. Size and color accept tokens only, so arbitrary
 * values fail typecheck. Width, height, fill, and transform stay under
 * token control and are absent here.
 */
export type IconProps = Omit<
  JSX.SvgSVGAttributes<SVGSVGElement>,
  "width" | "height" | "color" | "fill" | "transform" | "children" | "ref"
> & {
  readonly size?: IconSize;
  readonly color?: IconColor;
  readonly weight?: IconWeight;
  readonly mirrored?: boolean;
  readonly title?: string;
  readonly children?: JSX.Element;
  readonly class?: string;
  readonly ref?: SVGSVGElement | ((element: SVGSVGElement) => void) | undefined;
};

/**
 * One SVG path. Plain data, safe to share across icon instances. IconBase
 * creates live elements from these on each render.
 */
export type IconPath = {
  readonly d: string;
  readonly opacity?: string;
};

/** Path data for each weight. Every icon defines all six. */
export type IconPathData = Record<IconWeight, ReadonlyArray<IconPath>>;

export type IconBaseProps = IconProps & {
  readonly paths: IconPathData;
};

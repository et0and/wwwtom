import { merge, omit } from "solid-js";
import * as stylex from "@stylexjs/stylex";

export const TOMUI_LOADER_DEFAULT_VARIANTS = { size: "base" } as const;

export type TomuiLoaderSize = "sm" | "base" | "lg";

/** Pixel extents per size. Loader accepts a raw number for one-off sizing. */
const SIZES = {
  sm: 16,
  base: 24,
  lg: 32,
} as const satisfies Record<TomuiLoaderSize, number>;

export function loaderVariants(
  props: { size?: TomuiLoaderSize | number | undefined } = {},
): number {
  const size = props.size;
  if (size === undefined) return SIZES.base;
  if (size === "sm" || size === "base" || size === "lg") return SIZES[size];
  return size;
}

const styles = stylex.create({
  /** Dynamic square size, since callers may pass an arbitrary pixel value. */
  extent: (size: number) => ({ width: `${size}px`, height: `${size}px` }),
});

export type LoaderProps = {
  size?: TomuiLoaderSize | number;
  "aria-label"?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Loader(props: LoaderProps) {
  const merged = merge(
    { size: TOMUI_LOADER_DEFAULT_VARIANTS.size, "aria-label": "Loading" } as LoaderProps,
    props,
  );
  const rest = omit(merged, "size", "aria-label", "style");
  const sizeValue = () => loaderVariants({ size: merged.size });
  return (
    <svg
      {...stylex.attrs(styles.extent(sizeValue()), merged.style)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      role="status"
      aria-label={merged["aria-label"]}
      data-tomui-component="Loader"
      {...rest}
    >
      <circle cx="12" cy="12" r="9.5" fill="none" stroke-width="2" stroke-linecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dasharray"
          values="0 150;42 150;42 150"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          values="0;-16;-59"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        opacity={0.1}
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

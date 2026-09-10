import { merge, omit } from "solid-js";
import { cn } from "../../utils/cn";

export const TOMUI_LOADER_VARIANTS = {
  size: {
    sm: { value: 16, description: "Small loader for inline use" },
    base: { value: 24, description: "Default loader size" },
    lg: { value: 32, description: "Large loader for prominent loading states" },
  },
} as const;

export const TOMUI_LOADER_DEFAULT_VARIANTS = { size: "base" } as const;

export type TomuiLoaderSize = keyof typeof TOMUI_LOADER_VARIANTS.size;

export function loaderVariants(
  props: { size?: TomuiLoaderSize | number | undefined } = {},
): number {
  const merged = merge(TOMUI_LOADER_DEFAULT_VARIANTS, props);
  const size = merged.size;
  if (size === "sm" || size === "base" || size === "lg") {
    return TOMUI_LOADER_VARIANTS.size[size].value;
  }
  if (size === undefined) return TOMUI_LOADER_VARIANTS.size.base.value;
  return size;
}

export type LoaderProps = {
  class?: string;
  size?: TomuiLoaderSize | number;
  "aria-label"?: string;
};

export function Loader(props: LoaderProps) {
  const merged = merge(
    { size: TOMUI_LOADER_DEFAULT_VARIANTS.size, "aria-label": "Loading" } as LoaderProps,
    props,
  );
  const rest = omit(merged, "class", "size", "aria-label");
  const sizeValue = () => loaderVariants({ size: merged.size });
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      class={cn(merged.class)}
      style={{ height: `${sizeValue()}px`, width: `${sizeValue()}px` }}
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

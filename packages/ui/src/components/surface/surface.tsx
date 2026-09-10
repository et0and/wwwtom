import { merge, omit } from "solid-js";
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { layerCardVariants } from "../layer-card/layer-card";

/** Surface color variant definitions. */
export const TOMUI_SURFACE_VARIANTS = {
  color: {
    primary: {
      classes: "",
      description: "Primary surface color",
    },
    secondary: {
      classes: "",
      description: "Secondary surface color",
    },
  },
} as const;

export const TOMUI_SURFACE_DEFAULT_VARIANTS = {
  color: "primary",
} as const;

// Derived types from TOMUI_SURFACE_VARIANTS
export type TomuiSurfaceColor = keyof typeof TOMUI_SURFACE_VARIANTS.color;

export interface TomuiSurfaceVariantsProps {
  /**
   * Surface color variant.
   * - `"primary"` — Primary surface color
   * - `"secondary"` — Secondary surface color
   * @default "primary"
   */
  color?: TomuiSurfaceColor;
}

export function surfaceVariants(props: TomuiSurfaceVariantsProps = {}): string {
  const merged = merge(TOMUI_SURFACE_DEFAULT_VARIANTS, props);
  return resolveVariant(
    TOMUI_SURFACE_VARIANTS.color,
    merged.color,
    TOMUI_SURFACE_DEFAULT_VARIANTS.color,
  ).classes;
}

/**
 * Surface component props.
 *
 * @deprecated Use `LayerCard` instead. `Surface` is now a compatibility wrapper
 * around `LayerCard` styling for simple one-layer card containers.
 *
 * @example
 * ```tsx
 * <Surface class="rounded-lg p-4">Card content</Surface>
 * <Surface as="section" class="rounded-lg p-6">Section content</Surface>
 * ```
 */
export type SurfaceProps = Omit<JSX.HTMLAttributes<HTMLElement>, "ref"> &
  TomuiSurfaceVariantsProps & {
    /**
     * The HTML element to render.
     * @default "div"
     */
    as?: keyof JSX.IntrinsicElements;
    children?: JSX.Element;
    class?: string;
    ref?: HTMLElement | ((element: HTMLElement) => void) | undefined;
  };

/**
 * @deprecated Use `LayerCard` instead.
 *
 * Polymorphic compatibility wrapper that preserves the `Surface` API while
 * delegating styling to `LayerCard`.
 *
 * @example
 * ```tsx
 * <LayerCard class="rounded-lg p-4">Card content</LayerCard>
 * ```
 */
export function Surface(props: SurfaceProps): JSX.Element {
  const merged = merge(
    { as: "div" as keyof JSX.IntrinsicElements, color: TOMUI_SURFACE_DEFAULT_VARIANTS.color },
    props,
  );
  const rest = omit(merged, "as", "children", "class", "color", "ref");
  return (
    <Dynamic
      component={merged.as}
      data-tomui-component="Surface"
      data-surface-color={merged.color}
      data-deprecated="surface"
      class={cn(
        layerCardVariants(),
        "overflow-visible rounded-none",
        surfaceVariants({ color: merged.color }),
        merged.class,
      )}
      ref={merged.ref}
      {...rest}
    >
      {merged.children}
    </Dynamic>
  );
}

import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";

const LAYER_CARD_SURFACE_CLASSES =
  "overflow-hidden rounded-lg bg-tomui-base shadow-xs ring ring-tomui-line";
const LAYER_CARD_LAYERED_ROOT_CLASSES =
  "flex w-full flex-col overflow-hidden rounded-lg bg-tomui-elevated text-base ring ring-tomui-hairline";
const LAYER_CARD_SECONDARY_CLASSES =
  "-my-2 flex items-center gap-2 bg-tomui-elevated p-4 text-base font-medium text-tomui-subtle";
const LAYER_CARD_PRIMARY_CLASSES =
  "relative flex flex-col gap-2 overflow-hidden rounded-lg bg-tomui-base p-4 pr-3 text-inherit no-underline ring ring-tomui-fill";

/** LayerCard variant definitions (currently empty, reserved for future additions). */
export const TOMUI_LAYER_CARD_VARIANTS = {
  // LayerCard currently has no variant options but structure is ready for future additions
} as const;

export const TOMUI_LAYER_CARD_DEFAULT_VARIANTS = {} as const;

// Derived types from TOMUI_LAYER_CARD_VARIANTS
export interface TomuiLayerCardVariantsProps {}

export function layerCardVariants(): string {
  return cn(LAYER_CARD_SURFACE_CLASSES);
}

/**
 * LayerCard component props.
 *
 * @example
 * ```tsx
 * <LayerCard class="p-4">
 *   Get started with Tomui
 * </LayerCard>
 *
 * <LayerCard layered>
 *   <LayerCard.Secondary>Next Steps</LayerCard.Secondary>
 *   <LayerCard.Primary>Get started with Tomui</LayerCard.Primary>
 * </LayerCard>
 * ```
 */
export type LayerCardProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref"> &
  TomuiLayerCardVariantsProps & {
    children?: JSX.Element;
    class?: string;
    /**
     * Render the layered card treatment (elevated container for
     * `LayerCard.Secondary` + `LayerCard.Primary` sections).
     * Tomui auto-detects section children; Solid cannot inspect
     * children types, so this is explicit.
     * @default false
     */
    layered?: boolean;
    ref?: HTMLDivElement | ((element: HTMLDivElement) => void) | undefined;
  };

export type LayerCardSectionProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref"> & {
  children?: JSX.Element;
  class?: string;
};

/**
 * Card container for both simple surfaces and layered layouts.
 *
 * Render children directly for a single-surface card, or pass `layered` with
 * `LayerCard.Secondary` and `LayerCard.Primary` for the layered card treatment.
 *
 * @example
 * ```tsx
 * <LayerCard class="rounded-lg p-4">Card content</LayerCard>
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
  const rest = omit(merged, "children", "class", "layered", "ref");
  return (
    <div
      data-tomui-component="LayerCard"
      class={cn(
        merged.layered ? LAYER_CARD_LAYERED_ROOT_CLASSES : layerCardVariants(),
        merged.class,
      )}
      ref={merged.ref}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

function LayerCardSecondary(props: LayerCardSectionProps): JSX.Element {
  const rest = omit(props, "children", "class");
  return (
    <div
      data-tomui-component="LayerCard.Secondary"
      class={cn(LAYER_CARD_SECONDARY_CLASSES, props.class)}
      {...rest}
    >
      {props.children}
    </div>
  );
}

function LayerCardPrimary(props: LayerCardSectionProps): JSX.Element {
  const rest = omit(props, "children", "class");
  return (
    <div
      data-tomui-component="LayerCard.Primary"
      class={cn(LAYER_CARD_PRIMARY_CLASSES, props.class)}
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

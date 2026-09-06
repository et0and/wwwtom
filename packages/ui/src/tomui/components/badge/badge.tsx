import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_BADGE_BASE_STYLES =
  "inline-flex w-fit flex-none shrink-0 items-center justify-self-start gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [a:hover_&]:ring [a:hover_&]:ring-current";

export const TOMUI_BADGE_VARIANTS = {
  variant: {
    primary: {
      classes: "bg-tomui-badge-inverted text-tomui-badge-inverted",
      description: "Primary badge",
    },
    secondary: {
      classes: "bg-tomui-fill text-tomui-badge-neutral-subtle",
      description: "Secondary badge",
    },
    error: { classes: "bg-tomui-danger-tint text-tomui-danger", description: "Error badge" },
    warning: { classes: "bg-tomui-warning-tint text-tomui-warning", description: "Warning badge" },
    success: { classes: "bg-tomui-success-tint text-tomui-success", description: "Success badge" },
    destructive: {
      classes: "bg-tomui-badge-red text-white",
      description: "Deprecated. Use red instead.",
    },
    info: { classes: "bg-tomui-info-tint text-tomui-info", description: "Info badge" },
    beta: {
      classes: "border border-dashed border-tomui-brand bg-transparent text-tomui-link",
      description: "Indicates beta or experimental features",
    },
    outline: {
      classes: "border border-tomui-fill bg-tomui-base text-tomui-default",
      description: "Bordered badge with base background",
    },
    red: { classes: "bg-tomui-badge-red text-white", description: "Red badge" },
    green: { classes: "bg-tomui-badge-green text-white", description: "Green badge" },
    neutral: { classes: "bg-tomui-badge-neutral text-white", description: "Neutral badge" },
    orange: { classes: "bg-tomui-badge-orange text-black", description: "Orange badge" },
    purple: { classes: "bg-tomui-badge-purple text-white", description: "Purple badge" },
    teal: { classes: "bg-tomui-badge-teal text-white", description: "Teal badge" },
    "teal-subtle": {
      classes: "bg-tomui-badge-teal-subtle text-tomui-badge-teal-subtle",
      description: "Subtle teal badge",
    },
    blue: { classes: "bg-tomui-badge-blue text-white", description: "Blue badge" },
  },
  appearance: {
    filled: { classes: "", description: "Filled badge with background color (default)" },
    dot: {
      classes: "gap-1.5 bg-transparent text-tomui-default ring ring-tomui-hairline",
      description: "Outlined badge with a colored circle dot",
    },
  },
  dotColor: {
    none: { classes: "", description: "No dot indicator" },
    success: { classes: "bg-tomui-success", description: "Green dot for success status" },
    warning: { classes: "bg-tomui-badge-orange", description: "Orange dot for warning status" },
    error: { classes: "bg-tomui-badge-red", description: "Red dot for error status" },
    neutral: {
      classes: "bg-tomui-badge-neutral",
      description: "Neutral dot for informational status",
    },
  },
} as const;

export const TOMUI_BADGE_DEFAULT_VARIANTS = {
  variant: "primary",
  appearance: "filled",
  dotColor: "none",
} as const;

export type TomuiBadgeVariant = keyof typeof TOMUI_BADGE_VARIANTS.variant;
export type TomuiBadgeAppearance = keyof typeof TOMUI_BADGE_VARIANTS.appearance;

export function badgeVariants(
  props: { variant?: TomuiBadgeVariant; appearance?: TomuiBadgeAppearance } = {},
): string {
  const merged = merge(TOMUI_BADGE_DEFAULT_VARIANTS, props);
  const variantClasses = () =>
    resolveVariant(
      TOMUI_BADGE_VARIANTS.variant,
      merged.variant,
      TOMUI_BADGE_DEFAULT_VARIANTS.variant,
    ).classes;
  const appearanceClasses = () =>
    resolveVariant(
      TOMUI_BADGE_VARIANTS.appearance,
      merged.appearance,
      TOMUI_BADGE_DEFAULT_VARIANTS.appearance,
    ).classes;
  return cn(
    TOMUI_BADGE_BASE_STYLES,
    merged.appearance === "dot" ? "" : variantClasses(),
    appearanceClasses(),
  );
}

export type BadgeProps = {
  variant?: TomuiBadgeVariant;
  appearance?: TomuiBadgeAppearance;
  class?: string;
  icon?: JSX.Element;
  children: JSX.Element;
};

export function Badge(props: BadgeProps) {
  const merged = merge(TOMUI_BADGE_DEFAULT_VARIANTS, props);
  const rest = omit(merged, "variant", "appearance", "class", "icon", "children");
  const dotColor = () =>
    merged.appearance === "dot"
      ? resolveVariant(
          TOMUI_BADGE_VARIANTS.dotColor,
          merged.variant,
          TOMUI_BADGE_DEFAULT_VARIANTS.dotColor,
        ).classes
      : "";
  return (
    <span
      data-tomui-component="Badge"
      class={cn(
        badgeVariants({ variant: merged.variant, appearance: merged.appearance }),
        merged.icon && "pl-1.5",
        merged.class,
      )}
      {...rest}
    >
      <Show when={dotColor()}>
        {(color) => (
          <span aria-hidden="true" class={cn("size-1.75 shrink-0 rounded-full", color())} />
        )}
      </Show>
      <Show when={merged.icon}>
        {(icon) => (
          <span class="flex h-lh w-3 shrink-0 items-center justify-center [&>svg]:size-3">
            {icon()}
          </span>
        )}
      </Show>
      {merged.children}
    </span>
  );
}

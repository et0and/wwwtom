import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";
import { BannerAction, BannerActionContext, type BannerActionSize } from "./banner-action";

/** Structural base styles applied to all banners; size-specific spacing/alignment lives in `TOMUI_BANNER_VARIANTS.size`. */
export const TOMUI_BANNER_BASE_STYLES = "flex w-full";

/** Banner variant definitions mapping style options to their Tailwind classes and descriptions. */
export const TOMUI_BANNER_VARIANTS = {
  variant: {
    default: {
      classes: "bg-tomui-info-tint text-tomui-info",
      iconClasses: "fill-tomui-info",
      description: "Informational banner for general messages",
    },
    alert: {
      classes: "bg-tomui-warning-tint text-tomui-warning",
      iconClasses: "fill-tomui-warning",
      description: "Warning banner for cautionary messages",
    },
    error: {
      classes: "bg-tomui-danger-tint text-tomui-danger",
      iconClasses: "fill-tomui-danger",
      description: "Error banner for critical issues",
    },
    secondary: {
      classes: "bg-tomui-contrast/5 text-tomui-default/70",
      iconClasses: "fill-tomui-interact",
      description: "Neutral banner for secondary messages",
    },
  },
  size: {
    base: {
      classes: "items-start gap-3 rounded-lg px-4 py-3 text-base",
      description: "Default banner size",
    },
    sm: {
      classes: "items-center gap-2 rounded-md px-3 py-2 text-sm",
      description: "Compact banner for dialogs and tight spaces",
    },
  },
} as const;

export const TOMUI_BANNER_DEFAULT_VARIANTS = {
  variant: "default",
  size: "base",
} as const;

// Derived types from TOMUI_BANNER_VARIANTS
export type TomuiBannerVariant = keyof typeof TOMUI_BANNER_VARIANTS.variant;
export type TomuiBannerSize = keyof typeof TOMUI_BANNER_VARIANTS.size;

/**
 * Per-size render-site classes not carried by `bannerVariants` (which only emits
 * the container classes). `row` is the title↔action flex gap, `icon` the icon
 * wrapper height, `description` the description text size, and `action` the size
 * that child `Banner.Action`s inherit via `BannerActionContext`.
 */
const BANNER_SIZE_PARTS = {
  base: {
    row: "gap-3",
    icon: "h-[1.375em]",
    description: "text-sm",
    action: "sm",
  },
  sm: {
    row: "gap-2",
    icon: "h-[1.25em]",
    description: "text-sm",
    action: "xs",
  },
} satisfies Record<
  TomuiBannerSize,
  { row: string; icon: string; description: string; action: BannerActionSize }
>;

// The `Banner.Action` CTA compound lives in ./banner-action
// and is attached to `Banner` via Object.assign at the bottom of this file.

export interface TomuiBannerVariantsProps {
  /**
   * Visual style of the banner.
   * - `"default"` — Informational banner for general messages
   * - `"alert"` — Warning banner for cautionary messages
   * - `"error"` — Error banner for critical issues
   * - `"secondary"` — Neutral banner for secondary messages
   * @default "default"
   */
  variant?: TomuiBannerVariant;
  /**
   * Size of the banner.
   * - `"base"` — Default full-size banner
   * - `"sm"` — Compact banner for dialogs and other tight spaces
   * @default "base"
   */
  size?: TomuiBannerSize;
}

export function bannerVariants(props: TomuiBannerVariantsProps = {}): string {
  const merged = merge(TOMUI_BANNER_DEFAULT_VARIANTS, props);
  const resolvedVariant = resolveVariant(
    TOMUI_BANNER_VARIANTS.variant,
    merged.variant,
    TOMUI_BANNER_DEFAULT_VARIANTS.variant,
  );
  const resolvedSize = resolveVariant(
    TOMUI_BANNER_VARIANTS.size,
    merged.size,
    TOMUI_BANNER_DEFAULT_VARIANTS.size,
  );

  return cn(
    // Structural base styles (exported as TOMUI_BANNER_BASE_STYLES for Figma plugin)
    TOMUI_BANNER_BASE_STYLES,
    // Apply variant styles from TOMUI_BANNER_VARIANTS
    resolvedVariant.classes,
    // Apply size styles (spacing / radius / text) from TOMUI_BANNER_VARIANTS
    resolvedSize.classes,
  );
}

// Legacy enum for backwards compatibility
export enum BannerVariant {
  DEFAULT,
  ALERT,
  ERROR,
}

/**
 * Banner component props.
 *
 * @example
 * ```tsx
 * <Banner title="Update available" description="A new version is ready to install." />
 * <Banner variant="alert" title="Session expiring" description="Your session will expire soon." />
 * <Banner variant="error" title="Save failed" description="We couldn't save your changes." />
 * ```
 */
export interface BannerProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "title" | "ref"
> {
  /** Icon element rendered before the banner content. */
  icon?: JSX.Element;
  /** Primary heading text for the banner. Use for i18n string injection. */
  title?: string;
  /** Secondary description text displayed below the title. Use for i18n string injection. */
  description?: JSX.Element;
  /**
   * Action slot for a CTA button or link. Compact (`size="sm"`) banners render
   * the action inline with the description; base banners render it at the
   * trailing end. Use `Banner.Action` for accent-aware CTAs that self-style
   * to the banner variant; other nodes are rendered as-is. Only used in
   * structured mode (with `title` or `description`).
   */
  action?: JSX.Element;
  /** @deprecated Use `title` and `description` instead. Will be removed in a future major version. */
  text?: string;
  /** @deprecated Use `title` and `description` instead for better i18n support. */
  children?: JSX.Element;
  /**
   * Visual style of the banner.
   * - `"default"` — Informational blue banner for general messages
   * - `"alert"` — Warning yellow banner for cautionary messages
   * - `"error"` — Error red banner for critical issues
   * - `"secondary"` — Neutral banner for secondary messages
   * @default "default"
   */
  variant?: TomuiBannerVariant;
  /**
   * Size of the banner. A `"sm"` banner uses tighter spacing and `text-sm`,
   * renders the action inline with the description, and sets its
   * `Banner.Action` children to the `"xs"` size — suited to dialogs and other
   * tight spaces.
   * @default "base"
   */
  size?: TomuiBannerSize;
  /** Additional CSS classes merged via `cn()`. */
  class?: string;
  ref?: HTMLDivElement | ((element: HTMLDivElement) => void) | undefined;
}

/**
 * Full-width message bar for informational, warning, or error notices.
 * Supports structured title/description for i18n, or simple children for basic usage.
 *
 * @example
 * ```tsx
 * // Structured (recommended for i18n)
 * <Banner
 *   variant="alert"
 *   icon={<WarningCircleIcon />}
 *   title="Review required"
 *   description="Please review your billing information."
 * />
 *
 * // Simple (backwards compatible)
 * <Banner variant="alert" icon={<WarningCircleIcon />}>
 *   Review your billing information.
 * </Banner>
 * ```
 */
function BannerRoot(props: BannerProps): JSX.Element {
  const merged = merge(
    { variant: TOMUI_BANNER_DEFAULT_VARIANTS.variant, size: TOMUI_BANNER_DEFAULT_VARIANTS.size },
    props,
  );
  const rest = omit(
    merged,
    "action",
    "children",
    "class",
    "description",
    "icon",
    "ref",
    "size",
    "text",
    "title",
    "variant",
  );
  const variantConfig = () =>
    resolveVariant(
      TOMUI_BANNER_VARIANTS.variant,
      merged.variant,
      TOMUI_BANNER_DEFAULT_VARIANTS.variant,
    );
  const sizeParts = (): {
    row: string;
    icon: string;
    description: string;
    action: BannerActionSize;
  } => BANNER_SIZE_PARTS[merged.size] ?? BANNER_SIZE_PARTS.base;
  // Compact banners keep the title and description on one line (inline spans)
  // rather than stacking them, to stay short in dialogs and other tight spaces.
  const isCompact = (): boolean => merged.size === "sm";
  const isStructured = (): boolean =>
    merged.title !== undefined || merged.description !== undefined;
  const alertRole = (): "alert" | undefined => (merged.variant === "error" ? "alert" : undefined);

  return (
    <BannerActionContext value={{ variant: merged.variant, size: sizeParts().action }}>
      <Show
        when={isStructured()}
        fallback={
          <div
            data-tomui-component="Banner"
            role={alertRole()}
            class={cn(bannerVariants({ variant: merged.variant, size: merged.size }), merged.class)}
            ref={merged.ref}
            {...rest}
          >
            <Show when={merged.icon}>
              <span class={cn("shrink-0", variantConfig().iconClasses)}>{merged.icon}</span>
            </Show>
            <Show when={merged.children} fallback={<p>{merged.text}</p>}>
              {(kids) => <>{kids()}</>}
            </Show>
          </div>
        }
      >
        <div
          data-tomui-component="Banner"
          role={alertRole()}
          class={cn(bannerVariants({ variant: merged.variant, size: merged.size }), merged.class)}
          ref={merged.ref}
          {...rest}
        >
          <Show when={merged.icon}>
            <span
              class={cn(
                "flex shrink-0 items-center",
                sizeParts().icon,
                variantConfig().iconClasses,
              )}
            >
              {merged.icon}
            </span>
          </Show>
          <div
            class={cn(
              "flex min-w-0 flex-1 items-center justify-between",
              sizeParts().row,
              !merged.title ? "pt-px" : "",
            )}
          >
            <Show
              when={isCompact()}
              fallback={
                <div class="flex flex-col gap-0.5">
                  <Show when={merged.title}>
                    <p class="leading-snug font-medium">{merged.title}</p>
                  </Show>
                  <Show when={merged.description}>
                    <div class={cn(sizeParts().description, "leading-snug")}>
                      <p>{merged.description}</p>
                    </div>
                  </Show>
                </div>
              }
            >
              <div class="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                <Show when={merged.title}>
                  <span class="leading-snug font-medium">
                    {merged.title}
                    <Show when={!merged.description}>
                      <span class="ml-1.5 [&_[data-tomui-component=Link]]:inline">
                        {merged.action}
                      </span>
                    </Show>
                  </span>
                </Show>
                <Show when={merged.description}>
                  <span class={cn(sizeParts().description, "leading-snug")}>
                    {merged.description}
                    <span class="ml-1.5 [&_[data-tomui-component=Link]]:inline">
                      {merged.action}
                    </span>
                  </span>
                </Show>
              </div>
            </Show>
            <Show when={!isCompact()}>
              <Show when={merged.action}>
                <div class="flex shrink-0 items-center gap-2">{merged.action}</div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </BannerActionContext>
  );
}

/**
 * Full-width message bar with an optional trailing CTA slot.
 *
 * `Banner.Action` is an accent-aware CTA button
 * (`variant="primary" | "secondary" | "ghost"`).
 */
export const Banner = Object.assign(BannerRoot, {
  Action: BannerAction,
});

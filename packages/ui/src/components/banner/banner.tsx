import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeSm } from "../../styles/typography.stylex";
import { BannerAction, BannerActionContext, type BannerActionSize } from "./banner-action";

const contrastColor = colors["--color-tomui-contrast"];
const defaultTextColor = textColors["--text-color-tomui-default"];

const styles = stylex.create({
  base: { display: "flex", width: "100%" },
  variantDefault: {
    backgroundColor: colors["--color-tomui-info-tint"],
    color: textColors["--text-color-tomui-info"],
  },
  variantAlert: {
    backgroundColor: colors["--color-tomui-warning-tint"],
    color: textColors["--text-color-tomui-warning"],
  },
  variantError: {
    backgroundColor: colors["--color-tomui-danger-tint"],
    color: textColors["--text-color-tomui-danger"],
  },
  variantSecondary: {
    backgroundColor: "color-mix(in srgb, " + contrastColor + " 5%, transparent)",
    color: "color-mix(in srgb, " + defaultTextColor + " 70%, transparent)",
  },
  sizeBase: {
    alignItems: "flex-start",
    gap: "0.75rem",
    borderRadius: radius.lg.borderRadius,
    paddingInline: "1rem",
    paddingBlock: "0.75rem",
    ...fontSizeBase,
  },
  sizeSm: {
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: radius.md.borderRadius,
    paddingInline: "0.75rem",
    paddingBlock: "0.5rem",
    ...fontSizeSm,
  },
  iconWrap: { display: "flex", flexShrink: 0, alignItems: "center" },
  iconBase: { height: "1.375em" },
  iconSm: { height: "1.25em" },
  iconFillInfo: { fill: colors["--color-tomui-info"] },
  iconFillWarning: { fill: colors["--color-tomui-warning"] },
  iconFillDanger: { fill: colors["--color-tomui-danger"] },
  iconFillInteract: { fill: colors["--color-tomui-interact"] },
  body: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBase: { gap: "0.75rem" },
  rowSm: { gap: "0.5rem" },
  noTitlePad: { paddingTop: "1px" },
  stack: { display: "flex", flexDirection: "column", gap: "0.125rem" },
  title: { lineHeight: "1.375", fontWeight: 500 },
  description: { ...fontSizeSm, lineHeight: "1.375" },
  compactWrap: {
    display: "flex",
    minWidth: 0,
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: "0.375rem",
  },
  /** The display:inline override for a nested Link lives in tomui-binding.css; see the report. */
  inlineActionGap: { marginInlineStart: "0.375rem" },
  trailingAction: { display: "flex", flexShrink: 0, alignItems: "center", gap: "0.5rem" },
});

export type TomuiBannerVariant = "default" | "alert" | "error" | "secondary";
export type TomuiBannerSize = "base" | "sm";

export const TOMUI_BANNER_DEFAULT_VARIANTS = {
  variant: "default",
  size: "base",
} as const;

const variantStyles = {
  default: styles.variantDefault,
  alert: styles.variantAlert,
  error: styles.variantError,
  secondary: styles.variantSecondary,
} as const satisfies Record<TomuiBannerVariant, stylex.StyleXStyles>;

const sizeStyles = {
  base: styles.sizeBase,
  sm: styles.sizeSm,
} as const satisfies Record<TomuiBannerSize, stylex.StyleXStyles>;

const iconHeightStyles = {
  base: styles.iconBase,
  sm: styles.iconSm,
} as const satisfies Record<TomuiBannerSize, stylex.StyleXStyles>;

const iconFillStyles = {
  default: styles.iconFillInfo,
  alert: styles.iconFillWarning,
  error: styles.iconFillDanger,
  secondary: styles.iconFillInteract,
} as const satisfies Record<TomuiBannerVariant, stylex.StyleXStyles>;

const rowGapStyles = {
  base: styles.rowBase,
  sm: styles.rowSm,
} as const satisfies Record<TomuiBannerSize, stylex.StyleXStyles>;

/** The action size a `Banner.Action` child inherits, one step down from the banner size. */
const actionSizeBySize = {
  base: "sm",
  sm: "xs",
} as const satisfies Record<TomuiBannerSize, BannerActionSize>;

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

export function bannerVariants(props: TomuiBannerVariantsProps = {}): stylex.StyleXStyles[] {
  const merged = merge(TOMUI_BANNER_DEFAULT_VARIANTS, props);
  return [styles.base, variantStyles[merged.variant], sizeStyles[merged.size]];
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
  "children" | "title" | "ref" | "class" | "style"
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
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  ref?: HTMLDivElement | ((element: HTMLDivElement) => void) | undefined;
}

/**
 * Full-width message bar for informational, warning, or error notices.
 *
 * @example
 * ```tsx
 * <Banner
 *   variant="alert"
 *   icon={<WarningCircleIcon />}
 *   title="Review required"
 *   description="Please review your billing information."
 * />
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
    "description",
    "icon",
    "ref",
    "size",
    "style",
    "title",
    "variant",
  );
  // Compact banners keep the title and description on one line (inline spans)
  // rather than stacking them, to stay short in dialogs and other tight spaces.
  const isCompact = (): boolean => merged.size === "sm";
  const alertRole = (): "alert" | undefined => (merged.variant === "error" ? "alert" : undefined);

  return (
    <BannerActionContext value={{ variant: merged.variant, size: actionSizeBySize[merged.size] }}>
      <div
        data-tomui-component="Banner"
        role={alertRole()}
        ref={merged.ref}
        {...stylex.attrs(
          ...bannerVariants({ variant: merged.variant, size: merged.size }),
          merged.style,
        )}
        {...rest}
      >
        <Show when={merged.icon}>
          <span
            {...stylex.attrs(
              styles.iconWrap,
              iconHeightStyles[merged.size],
              iconFillStyles[merged.variant],
            )}
          >
            {merged.icon}
          </span>
        </Show>
        <div
          {...stylex.attrs(
            styles.body,
            rowGapStyles[merged.size],
            merged.title ? undefined : styles.noTitlePad,
          )}
        >
          <Show
            when={isCompact()}
            fallback={
              <div {...stylex.attrs(styles.stack)}>
                <Show when={merged.title}>
                  <p {...stylex.attrs(styles.title)}>{merged.title}</p>
                </Show>
                <Show when={merged.description}>
                  <div {...stylex.attrs(styles.description)}>
                    <p>{merged.description}</p>
                  </div>
                </Show>
              </div>
            }
          >
            <div {...stylex.attrs(styles.compactWrap)}>
              <Show when={merged.title}>
                <span {...stylex.attrs(styles.title)}>
                  {merged.title}
                  <Show when={!merged.description}>
                    <span
                      data-slot="banner-action-inline"
                      {...stylex.attrs(styles.inlineActionGap)}
                    >
                      {merged.action}
                    </span>
                  </Show>
                </span>
              </Show>
              <Show when={merged.description}>
                <span {...stylex.attrs(styles.description)}>
                  {merged.description}
                  <span data-slot="banner-action-inline" {...stylex.attrs(styles.inlineActionGap)}>
                    {merged.action}
                  </span>
                </span>
              </Show>
            </div>
          </Show>
          <Show when={!isCompact()}>
            <Show when={merged.action}>
              <div {...stylex.attrs(styles.trailingAction)}>{merged.action}</div>
            </Show>
          </Show>
        </div>
      </div>
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

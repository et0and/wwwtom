import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { textColors } from "../../styles/tokens.stylex";
import { radius } from "../../styles/primitives.stylex";

/**
 * OS dark-mode query. Matches initColorMode() in ../../utils/color-mode.ts,
 * which follows the OS setting and offers no user override. The old rules keyed
 * off the data-mode attribute, so this is equivalent and also applies before
 * hydration, when the attribute is not set yet.
 */
const DARK = "@media (prefers-color-scheme: dark)";

const linkColor = textColors["--text-color-tomui-link"];

const styles = stylex.create({
  root: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.1875em",
    // A link wrapping a badge rounds to the badge's pill shape.
    ":has(> [data-tomui-component=Badge])": { borderRadius: radius.full.borderRadius },
  },
  /** Defence against global `a` rules overriding the link colour. */
  inline: { color: linkColor },
  current: { color: "current" },
  plain: {
    color: linkColor,
    transitionProperty: "color",
    "@media (hover: hover) and (pointer: fine)": {
      ":hover": { color: "color-mix(in srgb, " + linkColor + " 70%, transparent)" },
    },
  },
  underlined: {
    textDecorationLine: "underline",
    textUnderlineOffset: "0.15em",
    textDecorationThickness: "0.0625em",
    textDecorationColor: "color-mix(in oklch, currentColor 35%, transparent)",
    transitionProperty: "color, text-decoration-color",
    [DARK]: { textDecorationColor: "color-mix(in oklch, currentColor 65%, transparent)" },
    "@media (hover: hover) and (pointer: fine)": {
      ":hover": { textDecorationColor: "currentColor" },
    },
  },
  /** A thicker stroke keeps the external-link icon visible on dark backgrounds. */
  externalIcon: {
    strokeWidth: 1.75,
    [DARK]: { strokeWidth: 2 },
  },
});

export const TOMUI_LINK_DEFAULT_VARIANTS = {
  variant: "inline",
} as const;

export type TomuiLinkVariant = "inline" | "current" | "plain";

export interface TomuiLinkVariantsProps {
  /**
   * Visual style of the link.
   * - `"inline"` — Inline text link that flows with content
   * - `"current"` — Link that inherits colour from the parent text
   * - `"plain"` — Link without underline decoration
   * @default "inline"
   */
  variant?: TomuiLinkVariant;
}

const variantStyles = {
  inline: styles.inline,
  current: styles.current,
  plain: styles.plain,
} as const satisfies Record<TomuiLinkVariant, stylex.StyleXStyles>;

export function linkVariants(props: TomuiLinkVariantsProps = {}) {
  const merged = merge(TOMUI_LINK_DEFAULT_VARIANTS, props);
  const isPlain = merged.variant === "plain";
  return [variantStyles[merged.variant], isPlain ? undefined : styles.underlined].filter(
    (style) => style !== undefined,
  );
}

/**
 * ExternalIcon - Visual indicator for links that open in a new tab/window.
 *
 * Use this as a child of Link to indicate external navigation:
 * ```tsx
 * <Link href="https://example.com" target="_blank" rel="noopener noreferrer">
 *   Visit Example <Link.ExternalIcon />
 * </Link>
 * ```
 */
function ExternalIconBase(
  props: Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "style"> & {
    /** Caller styles, merged last so they win. */
    style?: stylex.StyleXStyles;
  },
): JSX.Element {
  const rest = omit(props, "style");
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...stylex.attrs(styles.externalIcon, props.style)}
      {...rest}
    >
      <path d="M9 4H8.8C7.11984 4 6.27976 4 5.63803 4.32698C5.07354 4.6146 4.6146 5.07354 4.32698 5.63803C4 6.27976 4 7.11984 4 8.8V15.2C4 16.8802 4 17.7202 4.32698 18.362C4.6146 18.9265 5.07354 19.3854 5.63803 19.673C6.27976 20 7.11984 20 8.8 20H15.2C16.8802 20 17.7202 20 18.362 19.673C18.9265 19.3854 19.3854 18.9265 19.673 18.362C20 17.7202 20 16.8802 20 15.2V15" />
      <path d="M14 4H20M20 4V10M20 4L11 13" />
    </svg>
  );
}

/**
 * Link component props.
 *
 * Use `href` for the link destination.
 *
 * @example Internal link
 * ```tsx
 * <Link href="/docs">Learn more</Link>
 * ```
 *
 * @example External link
 * ```tsx
 * <Link href="https://cloudflare.com" target="_blank" rel="noopener noreferrer">
 *   Visit Cloudflare <Link.ExternalIcon />
 * </Link>
 * ```
 */
export type LinkProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "ref" | "style"> & {
  children?: JSX.Element;
  ref?: HTMLAnchorElement | ((element: HTMLAnchorElement) => void) | undefined;
  variant?: TomuiLinkVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

/**
 * Link component for consistent inline text links.
 *
 * Link is a **presentational component** — it handles visual styling and
 * accessibility. Routing behavior belongs in the application layer: pass an
 * `href`, or wrap router links around it.
 */
function LinkBase(props: LinkProps): JSX.Element {
  const merged = merge({ variant: TOMUI_LINK_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(merged, "children", "style", "ref", "rel", "target", "variant");
  const rel = (): LinkProps["rel"] => {
    if (merged.target !== "_blank" || merged.rel) return merged.rel;
    return "noopener noreferrer";
  };
  return (
    <a
      data-tomui-component="Link"
      {...stylex.attrs(styles.root, ...linkVariants({ variant: merged.variant }), merged.style)}
      ref={merged.ref}
      rel={rel()}
      target={merged.target}
      {...rest}
    >
      {merged.children}
    </a>
  );
}

// Compound component with ExternalIcon subcomponent
export const Link = Object.assign(LinkBase, {
  ExternalIcon: ExternalIconBase,
});

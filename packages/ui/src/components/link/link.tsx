import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

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
  props: Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "class"> & { class?: string },
): JSX.Element {
  const rest = omit(props, "class");
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
      class={cn("link-external-icon", props.class)}
      {...rest}
    >
      <path d="M9 4H8.8C7.11984 4 6.27976 4 5.63803 4.32698C5.07354 4.6146 4.6146 5.07354 4.32698 5.63803C4 6.27976 4 7.11984 4 8.8V15.2C4 16.8802 4 17.7202 4.32698 18.362C4.6146 18.9265 5.07354 19.3854 5.63803 19.673C6.27976 20 7.11984 20 8.8 20H15.2C16.8802 20 17.7202 20 18.362 19.673C18.9265 19.3854 19.3854 18.9265 19.673 18.362C20 17.7202 20 16.8802 20 15.2V15" />
      <path d="M14 4H20M20 4V10M20 4L11 13" />
    </svg>
  );
}

/** Link variant definitions mapping variant names to their Tailwind classes. */
export const TOMUI_LINK_VARIANTS = {
  variant: {
    inline: {
      classes:
        // text-tomui-link provides defensive color that won't be overridden by global `a` styles
        "text-tomui-link underline underline-offset-[0.15em] decoration-[0.0625em] link-current transition-colors",
      description: "Inline text link that flows with content",
    },
    current: {
      classes:
        "text-current underline underline-offset-[0.15em] decoration-[0.0625em] link-current transition-colors",
      description: "Link that inherits color from parent text",
    },
    plain: {
      classes:
        // text-tomui-link provides defensive color that won't be overridden by global `a` styles
        "text-tomui-link hover:text-tomui-link/70 transition-colors",
      description: "Link without underline decoration",
    },
  },
} as const;

export const TOMUI_LINK_DEFAULT_VARIANTS = {
  variant: "inline",
} as const;

export type TomuiLinkVariant = keyof typeof TOMUI_LINK_VARIANTS.variant;

export interface TomuiLinkVariantsProps {
  /**
   * Visual style of the link.
   * - `"inline"` — Inline text link that flows with content
   * - `"current"` — Link that inherits color from parent text
   * - `"plain"` — Link without underline decoration
   * @default "inline"
   */
  variant?: TomuiLinkVariant;
}

export function linkVariants(props: TomuiLinkVariantsProps = {}): string {
  const merged = merge(TOMUI_LINK_DEFAULT_VARIANTS, props);
  return cn(
    resolveVariant(TOMUI_LINK_VARIANTS.variant, merged.variant, TOMUI_LINK_DEFAULT_VARIANTS.variant)
      .classes,
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
export type LinkProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "ref"> & {
  children?: JSX.Element;
  class?: string;
  ref?: HTMLAnchorElement | ((element: HTMLAnchorElement) => void) | undefined;
  variant?: TomuiLinkVariant;
};

/**
 * Link component for consistent inline text links.
 *
 * Link is a **presentational component** — it handles visual styling and
 * accessibility. Routing behavior belongs in the application layer: pass an
 * `href`, or wrap router links around it.
 *
 * @example Basic usage
 * ```tsx
 * <Link href="/docs">Learn more</Link>
 * ```
 *
 * @example External link with icon
 * ```tsx
 * <Link href="https://cloudflare.com" target="_blank" rel="noopener noreferrer">
 *   Visit Cloudflare <Link.ExternalIcon />
 * </Link>
 * ```
 */
function LinkBase(props: LinkProps): JSX.Element {
  const merged = merge({ variant: TOMUI_LINK_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(merged, "children", "class", "ref", "rel", "target", "variant");
  const rel = (): LinkProps["rel"] => {
    if (merged.target !== "_blank" || merged.rel) return merged.rel;
    return "noopener noreferrer";
  };
  return (
    <a
      data-tomui-component="Link"
      class={cn(
        linkVariants({ variant: merged.variant }),
        "group/link inline-flex items-center gap-[0.1875em]",
        merged.class,
      )}
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

import { textColors } from "../../styles/colors.stylex";
import * as stylex from "@stylexjs/stylex";
import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { overflow } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs, fontWeightControl } from "../../styles/typography.stylex";

const styles = stylex.create({
  nav: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    alignItems: "center",
    overflow: "hidden",
    whiteSpace: "nowrap",
    marginInlineEnd: "1rem",
  },
  sizeSm: {
    fontSize: fontSizeXs.fontSize,
    lineHeight: fontSizeXs.lineHeight,
    height: "1.75rem",
    gap: "0.125rem",
  },
  sizeBase: {
    fontSize: fontSizeSm.fontSize,
    lineHeight: fontSizeSm.lineHeight,
    height: "2rem",
    gap: "0.25rem",
  },
  separator: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    color: textColors["--text-color-midori-inactive"],
  },
  current: {
    display: "flex",
    maxWidth: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: "0.25rem",
    fontWeight: fontWeightControl.fontWeight,
  },
  link: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: "0.25rem",
    whiteSpace: "nowrap",
    color: textColors["--text-color-midori-subtle"],
    textDecorationLine: "none",
  },
});

export type MidoriBreadcrumbsSize = "sm" | "base";

export const MIDORI_BREADCRUMBS_DEFAULT_VARIANTS = {
  size: "base",
} as const;

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
} as const satisfies Record<MidoriBreadcrumbsSize, stylex.StyleXStyles>;

export function breadcrumbsVariants(
  props: { size?: MidoriBreadcrumbsSize } = {},
): stylex.StyleXStyles[] {
  const merged = merge(MIDORI_BREADCRUMBS_DEFAULT_VARIANTS, props);
  return [styles.nav, sizeStyles[merged.size]];
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbsProps = Omit<JSX.HTMLAttributes<HTMLElement>, "class" | "style"> & {
  size?: MidoriBreadcrumbsSize;
  items?: ReadonlyArray<BreadcrumbItem>;
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Breadcrumbs(props: BreadcrumbsProps) {
  const merged = merge(
    { size: MIDORI_BREADCRUMBS_DEFAULT_VARIANTS.size, items: [] as ReadonlyArray<BreadcrumbItem> },
    props,
  );
  const rest = omit(merged, "children", "size", "items", "style");
  const lastIndex = () => merged.items.length - 1;
  return (
    <nav
      data-midori-component="Breadcrumbs"
      aria-label="breadcrumb"
      {...stylex.attrs(...breadcrumbsVariants({ size: merged.size }), merged.style)}
      {...rest}
    >
      <Show when={merged.items.length > 0} fallback={merged.children}>
        <For each={merged.items}>
          {(item, index) => (
            <>
              <Show when={index() > 0}>
                <span aria-hidden="true" {...stylex.attrs(styles.separator)}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <path
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M10.75 8.75L14.25 12L10.75 15.25"
                    />
                  </svg>
                </span>
              </Show>
              <Show
                when={item.href && index() !== lastIndex()}
                fallback={
                  <span
                    aria-current={index() === lastIndex() ? "page" : undefined}
                    {...stylex.attrs(styles.current)}
                  >
                    <span {...stylex.attrs(overflow.truncate, overflow.noWrap)}>{item.label}</span>
                  </span>
                }
              >
                <a href={item.href} {...stylex.attrs(styles.link)}>
                  <span>{item.label}</span>
                </a>
              </Show>
            </>
          )}
        </For>
      </Show>
    </nav>
  );
}

export type BreadcrumbLinkProps = Omit<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  "class" | "style"
> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function BreadcrumbLink(props: BreadcrumbLinkProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <a
      data-midori-component="BreadcrumbLink"
      {...stylex.attrs(styles.link, merged.style)}
      {...rest}
    >
      {merged.children}
    </a>
  );
}

export type BreadcrumbCurrentProps = Omit<
  JSX.HTMLAttributes<HTMLSpanElement>,
  "class" | "style"
> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function BreadcrumbCurrent(props: BreadcrumbCurrentProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <span
      data-midori-component="BreadcrumbCurrent"
      aria-current="page"
      {...stylex.attrs(styles.current, merged.style)}
      {...rest}
    >
      <span {...stylex.attrs(overflow.truncate, overflow.noWrap)}>{merged.children}</span>
    </span>
  );
}

export function BreadcrumbSeparator() {
  return (
    <span aria-hidden="true" {...stylex.attrs(styles.separator)}>
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M10.75 8.75L14.25 12L10.75 15.25"
        />
      </svg>
    </span>
  );
}

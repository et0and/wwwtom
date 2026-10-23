import * as stylex from "@stylexjs/stylex";
import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { overflow } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeSm } from "../../styles/typography.stylex";

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
  sizeSm: { ...fontSizeSm, height: "2.5rem", gap: "0.125rem" },
  sizeBase: { ...fontSizeBase, height: "3rem", gap: "0.25rem" },
  separator: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    color: textColors["--text-color-tomui-inactive"],
  },
  current: {
    display: "flex",
    maxWidth: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: "0.25rem",
    fontWeight: 500,
  },
  link: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: "0.25rem",
    whiteSpace: "nowrap",
    color: textColors["--text-color-tomui-subtle"],
    textDecorationLine: "none",
  },
});

export type TomuiBreadcrumbsSize = "sm" | "base";

export const TOMUI_BREADCRUMBS_DEFAULT_VARIANTS = {
  size: "base",
} as const;

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
} as const satisfies Record<TomuiBreadcrumbsSize, stylex.StyleXStyles>;

export function breadcrumbsVariants(
  props: { size?: TomuiBreadcrumbsSize } = {},
): stylex.StyleXStyles[] {
  const merged = merge(TOMUI_BREADCRUMBS_DEFAULT_VARIANTS, props);
  return [styles.nav, sizeStyles[merged.size]];
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbsProps = Omit<JSX.HTMLAttributes<HTMLElement>, "class" | "style"> & {
  size?: TomuiBreadcrumbsSize;
  items?: ReadonlyArray<BreadcrumbItem>;
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Breadcrumbs(props: BreadcrumbsProps) {
  const merged = merge(
    { size: TOMUI_BREADCRUMBS_DEFAULT_VARIANTS.size, items: [] as ReadonlyArray<BreadcrumbItem> },
    props,
  );
  const rest = omit(merged, "children", "size", "items", "style");
  const lastIndex = () => merged.items.length - 1;
  return (
    <nav
      data-tomui-component="Breadcrumbs"
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
    <a data-tomui-component="BreadcrumbLink" {...stylex.attrs(styles.link, merged.style)} {...rest}>
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
      data-tomui-component="BreadcrumbCurrent"
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

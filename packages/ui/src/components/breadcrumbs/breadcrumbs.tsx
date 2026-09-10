import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_BREADCRUMBS_VARIANTS = {
  size: {
    sm: { classes: "text-sm h-10 gap-0.5", description: "Compact breadcrumbs for dense UIs" },
    base: { classes: "text-base h-12 gap-1", description: "Default breadcrumbs size" },
  },
} as const;

export const TOMUI_BREADCRUMBS_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiBreadcrumbsSize = keyof typeof TOMUI_BREADCRUMBS_VARIANTS.size;

export function breadcrumbsVariants(props: { size?: TomuiBreadcrumbsSize } = {}): string {
  const merged = merge(TOMUI_BREADCRUMBS_DEFAULT_VARIANTS, props);
  return cn(
    "group mr-4 flex min-w-0 grow items-center overflow-hidden whitespace-nowrap",
    resolveVariant(
      TOMUI_BREADCRUMBS_VARIANTS.size,
      merged.size,
      TOMUI_BREADCRUMBS_DEFAULT_VARIANTS.size,
    ).classes,
  );
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbsProps = JSX.HTMLAttributes<HTMLElement> & {
  class?: string;
  size?: TomuiBreadcrumbsSize;
  items?: ReadonlyArray<BreadcrumbItem>;
  children?: JSX.Element;
};

export function Breadcrumbs(props: BreadcrumbsProps) {
  const merged = merge(
    { size: TOMUI_BREADCRUMBS_DEFAULT_VARIANTS.size, items: [] as ReadonlyArray<BreadcrumbItem> },
    props,
  );
  const rest = omit(merged, "children", "class", "size", "items");
  const lastIndex = () => merged.items.length - 1;
  return (
    <nav
      data-tomui-component="Breadcrumbs"
      aria-label="breadcrumb"
      class={cn(breadcrumbsVariants({ size: merged.size }), merged.class)}
      {...rest}
    >
      <Show when={merged.items.length > 0} fallback={merged.children}>
        <For each={merged.items}>
          {(item, index) => (
            <>
              <Show when={index() > 0}>
                <span class="flex shrink-0 items-center text-tomui-inactive" aria-hidden="true">
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
                    class="truncate font-medium text-tomui-default"
                  >
                    {item.label}
                  </span>
                }
              >
                <a
                  href={item.href}
                  class="flex shrink-0 items-center gap-1 whitespace-nowrap text-tomui-subtle no-underline"
                >
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

export type BreadcrumbLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: JSX.Element;
  class?: string;
};

export function BreadcrumbLink(props: BreadcrumbLinkProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <a
      data-tomui-component="BreadcrumbLink"
      class={cn(
        "flex shrink-0 items-center gap-1 whitespace-nowrap text-tomui-subtle no-underline",
        merged.class,
      )}
      {...rest}
    >
      {merged.children}
    </a>
  );
}

export type BreadcrumbCurrentProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  children?: JSX.Element;
  class?: string;
};

export function BreadcrumbCurrent(props: BreadcrumbCurrentProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <span
      data-tomui-component="BreadcrumbCurrent"
      aria-current="page"
      class={cn("truncate font-medium text-tomui-default", merged.class)}
      {...rest}
    >
      {merged.children}
    </span>
  );
}

export function BreadcrumbSeparator() {
  return (
    <span class="flex shrink-0 items-center text-tomui-inactive" aria-hidden="true">
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

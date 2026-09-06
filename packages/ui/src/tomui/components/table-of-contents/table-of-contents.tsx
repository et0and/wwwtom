import { createSignal, For, merge, omit, onCleanup, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_TABLE_OF_CONTENTS_VARIANTS = {
  state: {
    default: {
      classes:
        "text-tomui-subtle hover:border-tomui-line hover:text-tomui-default hover:font-medium",
      description: "Inactive section link",
    },
    active: {
      classes: "border-tomui-brand font-medium text-tomui-default",
      description: "Currently visible / active section",
    },
  },
} as const;

export const TOMUI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS = {
  state: "default",
} as const;

export type TomuiTableOfContentsState = keyof typeof TOMUI_TABLE_OF_CONTENTS_VARIANTS.state;

export interface TocHeading {
  id: string;
  label: string;
  level?: number;
}

export type TableOfContentsProps = JSX.HTMLAttributes<HTMLElement> & {
  activeId?: string;
  class?: string;
  headings?: Array<TocHeading>;
  offset?: number;
  title?: string;
};

const ITEM_BASE =
  "tomui-toc-item block w-full truncate border-l-2 border-transparent py-0.5 pl-4 text-sm text-left no-underline";

export function tocItemVariants(props: { state?: TomuiTableOfContentsState } = {}): string {
  const merged = merge(TOMUI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS, props);
  return cn(
    ITEM_BASE,
    resolveVariant(
      TOMUI_TABLE_OF_CONTENTS_VARIANTS.state,
      merged.state,
      TOMUI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS.state,
    ).classes,
  );
}

export function TableOfContents(props: TableOfContentsProps) {
  const merged = merge(
    { headings: [] as Array<TocHeading>, offset: 0, title: "On this page" },
    props,
  );
  const rest = omit(merged, "activeId", "children", "class", "headings", "offset", "title");
  const [activeId, setActiveId] = createSignal<string | null>(merged.activeId ?? null);
  const setActive = (id: string) => setActiveId(id);
  const observed = (): Array<string> => merged.headings.map((heading: TocHeading) => heading.id);
  onSettled(() => {
    if (merged.activeId !== undefined) return;
    const elements = observed()
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        const first = elements.find((el) => visible.has(el));
        if (first) setActiveId(first.id);
      },
      { rootMargin: `-${merged.offset}px 0px 0px 0px` },
    );
    for (const el of elements) observer.observe(el);
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && observed().includes(id)) setActiveId(id);
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  });
  onCleanup(() => setActiveId(null));
  return (
    <nav
      data-tomui-component="TableOfContents"
      aria-label="Table of contents"
      class={cn("tomui-toc", merged.class)}
      {...rest}
    >
      <p class="mb-3 text-xs font-semibold tracking-wide text-tomui-subtle uppercase">
        {merged.title}
      </p>
      <ul class="flex flex-col gap-2 border-l-2 border-tomui-hairline">
        <For each={merged.headings}>
          {(heading: TocHeading) => {
            const isActive = () => (merged.activeId ?? activeId()) === heading.id;
            return (
              <li class="-ml-0.5">
                <a
                  href={`#${heading.id}`}
                  aria-current={isActive() ? ("true" as const) : undefined}
                  data-tomui-component="TableOfContentsItem"
                  data-active={isActive() || undefined}
                  onClick={() => setActive(heading.id)}
                  class={cn(tocItemVariants({ state: isActive() ? "active" : "default" }))}
                  style={
                    heading.level !== undefined && heading.level > 2
                      ? { "padding-left": `${1 + (heading.level - 2) * 0.75}rem` }
                      : undefined
                  }
                >
                  <span class="block min-w-0 leading-5">{heading.label}</span>
                </a>
              </li>
            );
          }}
        </For>
      </ul>
      {merged.children}
    </nav>
  );
}

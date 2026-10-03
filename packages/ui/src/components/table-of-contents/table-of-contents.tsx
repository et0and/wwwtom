import * as stylex from "@stylexjs/stylex";
import { createSignal, For, merge, omit, onCleanup, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { overflow, textAlign, weight } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeSm, fontSizeXs } from "../../styles/typography.stylex";

export const TOMUI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS = {
  state: "default",
} as const;

export type TomuiTableOfContentsState = "default" | "active";

export interface TocHeading {
  id: string;
  label: string;
  level?: number;
}

export type TableOfContentsProps = Omit<JSX.HTMLAttributes<HTMLElement>, "style"> & {
  activeId?: string;
  headings?: Array<TocHeading>;
  offset?: number;
  title?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

const styles = stylex.create({
  title: {
    marginBottom: "0.75rem",
    fontSize: fontSizeXs.fontSize,
    fontWeight: weight.semibold.fontWeight,
    letterSpacing: "0.025em",
    color: textColors["--text-color-tomui-subtle"],
    textTransform: "uppercase",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    borderLeftWidth: 2,
    borderLeftColor: colors["--color-tomui-hairline"],
  },
  listItem: { marginLeft: "-0.125rem" },
  itemBase: {
    display: "block",
    width: "100%",
    paddingBlock: "0.125rem",
    paddingLeft: "1rem",
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
    fontSize: fontSizeSm.fontSize,
    textDecorationLine: "none",
  },
  itemDefault: {
    color: textColors["--text-color-tomui-subtle"],
    ":hover": {
      borderLeftColor: colors["--color-tomui-line"],
      color: textColors["--text-color-tomui-default"],
      fontWeight: 500,
    },
  },
  itemActive: {
    borderLeftColor: colors["--color-tomui-brand"],
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
  },
  itemLabel: { display: "block", minWidth: 0, lineHeight: "1.25rem" },
});

const stateStyles = {
  default: styles.itemDefault,
  active: styles.itemActive,
} as const satisfies Record<TomuiTableOfContentsState, stylex.StyleXStyles>;

export function tocItemVariants(props: { state?: TomuiTableOfContentsState } = {}) {
  const merged = merge(TOMUI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS, props);
  return [
    styles.itemBase,
    overflow.truncate,
    overflow.noWrap,
    textAlign.left,
    stateStyles[merged.state],
  ];
}

export function TableOfContents(props: TableOfContentsProps) {
  const merged = merge(
    { headings: [] as Array<TocHeading>, offset: 0, title: "On this page" },
    props,
  );
  const rest = omit(merged, "activeId", "children", "headings", "offset", "title", "style");
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
      {...stylex.attrs(merged.style)}
      {...rest}
    >
      <p {...stylex.attrs(styles.title)}>{merged.title}</p>
      <ul {...stylex.attrs(styles.list)}>
        <For each={merged.headings}>
          {(heading: TocHeading) => {
            const isActive = () => (merged.activeId ?? activeId()) === heading.id;
            return (
              <li {...stylex.attrs(styles.listItem)}>
                <a
                  href={`#${heading.id}`}
                  aria-current={isActive() ? ("true" as const) : undefined}
                  data-tomui-component="TableOfContentsItem"
                  data-active={isActive() || undefined}
                  onClick={() => setActive(heading.id)}
                  {...stylex.attrs(
                    ...tocItemVariants({ state: isActive() ? "active" : "default" }),
                  )}
                  style={
                    heading.level !== undefined && heading.level > 2
                      ? { "padding-left": `${1 + (heading.level - 2) * 0.75}rem` }
                      : undefined
                  }
                >
                  <span {...stylex.attrs(styles.itemLabel)}>{heading.label}</span>
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

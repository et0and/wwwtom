import * as stylex from "@stylexjs/stylex";
import { createSignal, For, merge, omit, onCleanup, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { overflow, textAlign } from "../../styles/primitives.stylex";
import { fontSize2xs, fontSizeSm } from "../../styles/typography.stylex";

export const MIDORI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS = {
  state: "default",
} as const;

export type MidoriTableOfContentsState = "default" | "active";

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
    marginBottom: "0.5rem",
    fontSize: fontSize2xs.fontSize,
    fontWeight: 530,
    color: textColors["--text-color-midori-subtle"],
    textTransform: "uppercase",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    borderLeftWidth: "0.5px",
    borderLeftColor: colors["--color-midori-hairline"],
  },
  listItem: { marginLeft: "-0.125rem" },
  itemBase: {
    display: "block",
    width: "100%",
    paddingBlock: "0.125rem",
    paddingLeft: "0.75rem",
    borderLeftWidth: "1px",
    borderLeftColor: "transparent",
    fontSize: fontSizeSm.fontSize,
    textDecorationLine: "none",
  },
  itemDefault: {
    color: textColors["--text-color-midori-subtle"],
    ":hover": {
      borderLeftColor: colors["--color-midori-line"],
      color: textColors["--text-color-midori-default"],
      fontWeight: 530,
    },
  },
  itemActive: {
    borderLeftColor: colors["--color-midori-brand"],
    fontWeight: 530,
    color: textColors["--text-color-midori-default"],
  },
  itemLabel: { display: "block", minWidth: 0, lineHeight: "1.25rem" },
});

const stateStyles = {
  default: styles.itemDefault,
  active: styles.itemActive,
} as const satisfies Record<MidoriTableOfContentsState, stylex.StyleXStyles>;

export function tocItemVariants(props: { state?: MidoriTableOfContentsState } = {}) {
  const merged = merge(MIDORI_TABLE_OF_CONTENTS_DEFAULT_VARIANTS, props);
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
      data-midori-component="TableOfContents"
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
                  data-midori-component="TableOfContentsItem"
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

import * as stylex from "@stylexjs/stylex";
import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_PAGINATION_DEFAULT_VARIANTS = {
  controls: "full",
} as const;

export type TomuiPaginationControls = "full" | "simple";

const line = colors["--color-tomui-line"];
const base = colors["--color-tomui-base"];
const tint = colors["--color-tomui-tint"];
const defaultText = textColors["--text-color-tomui-default"];

const styles = stylex.create({
  root: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  pagesWrap: { display: "flex", alignItems: "center", gap: "0.25rem" },
  button: {
    position: "relative",
    display: "flex",
    height: "2.25rem",
    minWidth: "2.25rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.5rem",
    borderWidth: 0,
    paddingInline: "0.5rem",
    fontSize: "0.875rem",
    boxShadow: "0 0 0 1px " + line,
    backgroundColor: base,
    color: defaultText,
    cursor: "pointer",
    ":not(:disabled):hover": { backgroundColor: tint },
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
  },
  buttonActive: { backgroundColor: tint, fontWeight: 500 },
});

function pageWindow(page: number, pageCount: number): Array<number> {
  const clamped = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const start = Math.max(1, Math.min(clamped - 2, Math.max(pageCount - 4, 1)));
  const end = Math.min(pageCount, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
}

export type PaginationProps = Omit<JSX.HTMLAttributes<HTMLElement>, "onChange" | "style"> & {
  controls?: TomuiPaginationControls;
  page?: number;
  pageCount?: number;
  onChange?: (page: number) => void;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Pagination(props: PaginationProps) {
  const merged = merge(
    { controls: TOMUI_PAGINATION_DEFAULT_VARIANTS.controls, page: 1, pageCount: 1 },
    props,
  );
  const rest = omit(
    merged,
    "children",
    "class",
    "style",
    "controls",
    "page",
    "pageCount",
    "onChange",
  );
  const safeCount = () => Math.max(1, merged.pageCount);
  const current = () => Math.min(Math.max(merged.page, 1), safeCount());
  const go = (page: number) => {
    const next = Math.min(Math.max(page, 1), safeCount());
    if (next !== current()) merged.onChange?.(next);
  };
  const pages = () => pageWindow(current(), safeCount());
  return (
    <nav
      data-tomui-component="Pagination"
      aria-label="Pagination"
      {...stylex.attrs(styles.root, merged.style)}
      {...rest}
    >
      <Show when={merged.controls === "full"}>
        <button
          type="button"
          aria-label="First page"
          disabled={current() <= 1}
          onClick={() => go(1)}
          {...stylex.attrs(styles.button)}
        >
          «
        </button>
      </Show>
      <button
        type="button"
        aria-label="Previous page"
        disabled={current() <= 1}
        onClick={() => go(current() - 1)}
        {...stylex.attrs(styles.button)}
      >
        ‹
      </button>
      <div {...stylex.attrs(styles.pagesWrap)}>
        <For each={pages()}>
          {(page) => (
            <button
              type="button"
              aria-label={`Page ${page}`}
              aria-current={page === current() ? "page" : undefined}
              onClick={() => go(page)}
              {...stylex.attrs(styles.button, page === current() ? styles.buttonActive : undefined)}
            >
              {page}
            </button>
          )}
        </For>
      </div>
      <button
        type="button"
        aria-label="Next page"
        disabled={current() >= safeCount()}
        onClick={() => go(current() + 1)}
        {...stylex.attrs(styles.button)}
      >
        ›
      </button>
      <Show when={merged.controls === "full"}>
        <button
          type="button"
          aria-label="Last page"
          disabled={current() >= safeCount()}
          onClick={() => go(safeCount())}
          {...stylex.attrs(styles.button)}
        >
          »
        </button>
      </Show>
      {merged.children}
    </nav>
  );
}

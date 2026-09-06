import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_PAGINATION_VARIANTS = {
  controls: {
    full: {
      classes: "",
      description: "Full pagination controls with first, previous, pages, next, and last buttons",
    },
    simple: {
      classes: "",
      description: "Simple pagination controls with only previous and next buttons",
    },
  },
} as const;

export const TOMUI_PAGINATION_DEFAULT_VARIANTS = {
  controls: "full",
} as const;

export type TomuiPaginationControls = keyof typeof TOMUI_PAGINATION_VARIANTS.controls;

export function paginationVariants(props: { controls?: TomuiPaginationControls } = {}): string {
  const merged = merge(TOMUI_PAGINATION_DEFAULT_VARIANTS, props);
  return cn(
    "flex items-center justify-between gap-2",
    resolveVariant(
      TOMUI_PAGINATION_VARIANTS.controls,
      merged.controls,
      TOMUI_PAGINATION_DEFAULT_VARIANTS.controls,
    ).classes,
  );
}

const buttonClasses =
  "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base ring ring-tomui-line bg-tomui-base text-tomui-default cursor-pointer not-disabled:hover:bg-tomui-tint disabled:cursor-not-allowed disabled:opacity-50";

function pageWindow(page: number, pageCount: number): Array<number> {
  const clamped = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const start = Math.max(1, Math.min(clamped - 2, Math.max(pageCount - 4, 1)));
  const end = Math.min(pageCount, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
}

export type PaginationProps = Omit<JSX.HTMLAttributes<HTMLElement>, "onChange"> & {
  class?: string;
  controls?: TomuiPaginationControls;
  page?: number;
  pageCount?: number;
  onChange?: (page: number) => void;
};

export function Pagination(props: PaginationProps) {
  const merged = merge(
    { controls: TOMUI_PAGINATION_DEFAULT_VARIANTS.controls, page: 1, pageCount: 1 },
    props,
  );
  const rest = omit(merged, "children", "class", "controls", "page", "pageCount", "onChange");
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
      class={cn(paginationVariants({ controls: merged.controls }), merged.class)}
      {...rest}
    >
      <Show when={merged.controls === "full"}>
        <button
          type="button"
          aria-label="First page"
          class={buttonClasses}
          disabled={current() <= 1}
          onClick={() => go(1)}
        >
          «
        </button>
      </Show>
      <button
        type="button"
        aria-label="Previous page"
        class={buttonClasses}
        disabled={current() <= 1}
        onClick={() => go(current() - 1)}
      >
        ‹
      </button>
      <div class="flex items-center gap-1">
        <For each={pages()}>
          {(page) => (
            <button
              type="button"
              aria-label={`Page ${page}`}
              aria-current={page === current() ? "page" : undefined}
              class={cn(buttonClasses, page === current() && "bg-tomui-tint font-medium")}
              onClick={() => go(page)}
            >
              {page}
            </button>
          )}
        </For>
      </div>
      <button
        type="button"
        aria-label="Next page"
        class={buttonClasses}
        disabled={current() >= safeCount()}
        onClick={() => go(current() + 1)}
      >
        ›
      </button>
      <Show when={merged.controls === "full"}>
        <button
          type="button"
          aria-label="Last page"
          class={buttonClasses}
          disabled={current() >= safeCount()}
          onClick={() => go(safeCount())}
        >
          »
        </button>
      </Show>
      {merged.children}
    </nav>
  );
}

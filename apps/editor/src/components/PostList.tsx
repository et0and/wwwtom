import { For, Show, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsError } from "@tom/types/errors";
import type { CmsListResponse, CmsPost, CmsWork } from "@tom/schemas/cms";
import { Button } from "@tom/ui/button";
import { Badge } from "@tom/ui/badge";
import { Banner } from "@tom/ui/banner";
import { Loader } from "@tom/ui/loader";
import { Pagination } from "@tom/ui/pagination";
import { deletePost, deleteWork, listPosts, listWorks } from "../lib/content";
import type { ContentKind } from "../lib/content";
import { runClient } from "../lib/api";

export type ContentRow = {
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly updatedAt: string;
};

const toRow = (item: CmsPost | CmsWork): ContentRow => ({
  slug: item.slug,
  title: item.title,
  status: item.status,
  updatedAt: item.updatedAt,
});

/**
 * Post/work list with kind toggle. Loads through the admin status filter
 * so drafts show alongside published rows. Page and kind live in the URL
 * so refresh and back navigation restore the same list. Sophie Camus
 * manages posts only, so the Works toggle stays hidden there.
 */
export const PostList = (props: { onEdit: (kind: ContentKind, slug: string | null) => void }) => {
  const sophieMode = (): boolean => import.meta.env.VITE_SOPHIE === "true";
  const initialParams = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("kind");
    const kind = tab === "works" && !sophieMode() ? "works" : "posts";
    const pagesOnly = sophieMode() && tab === "pages";
    const page = Number(params.get("page"));
    return { kind, pagesOnly, page: Number.isInteger(page) && page > 0 ? page : 1 } satisfies {
      kind: ContentKind;
      pagesOnly: boolean;
      page: number;
    };
  };
  const initial = initialParams();
  const [kind, setKind] = createSignal(initial.kind);
  const [pagesOnly, setPagesOnly] = createSignal(initial.pagesOnly);
  const [page, setPage] = createSignal(initial.page);
  const [pageCount, setPageCount] = createSignal(1);
  const [rows, setRows] = createSignal<ReadonlyArray<ContentRow>>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | undefined>(undefined);

  const writeParams = (nextKind: ContentKind, nextPage: number, onlyPages: boolean): void => {
    const params = new URLSearchParams(window.location.search);
    params.set("kind", onlyPages ? "pages" : nextKind);
    params.set("page", String(nextPage));
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const loadPage = (
    next: ContentKind,
    nextPage: number,
    onlyPages: boolean,
  ): Effect.Effect<void, CmsError> => {
    const list: Effect.Effect<CmsListResponse<CmsPost> | CmsListResponse<CmsWork>, CmsError> =
      next === "posts" ? listPosts(nextPage, onlyPages ? "pages" : undefined) : listWorks(nextPage);
    return list.pipe(
      Effect.map((list) => ({
        rows: list.docs.map(toRow),
        pages: Math.max(1, list.totalPages),
      })),
      Effect.flatMap((loaded): Effect.Effect<void, CmsError> => {
        const safePage = Math.min(nextPage, loaded.pages);
        if (safePage !== nextPage) return loadPage(next, safePage, onlyPages);
        if (loaded.rows.length === 0 && safePage > 1)
          return loadPage(next, safePage - 1, onlyPages);
        return Effect.sync(() => {
          setRows(loaded.rows);
          setPageCount(loaded.pages);
          setPage(safePage);
          writeParams(next, safePage, onlyPages);
          setLoading(false);
        });
      }),
    );
  };

  const load = (next: ContentKind, nextPage: number, onlyPages: boolean): void => {
    setLoading(true);
    setError(undefined);
    void runClient(
      loadPage(next, nextPage, onlyPages).pipe(
        Effect.catch((cause) =>
          Effect.sync(() => {
            setError(cause.message);
            setLoading(false);
          }),
        ),
      ),
    );
  };

  onSettled(() => {
    load(initial.kind, initial.page, initial.pagesOnly);
    const onPopState = (): void => {
      const restored = initialParams();
      setKind(restored.kind);
      setPagesOnly(restored.pagesOnly);
      load(restored.kind, restored.page, restored.pagesOnly);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  });

  const switchKind = (next: ContentKind, onlyPages = false): void => {
    setKind(next);
    setPagesOnly(sophieMode() && onlyPages);
    load(next, 1, sophieMode() && onlyPages);
  };

  const onDelete = (slug: string): void => {
    if (!window.confirm(`Delete ${slug}?`)) return;
    const current = kind();
    void runClient(
      (current === "posts" ? deletePost(slug) : deleteWork(slug)).pipe(
        Effect.tap(() => Effect.sync(() => load(current, page(), pagesOnly()))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  return (
    <div class="content-list">
      <div class="content-list-header">
        <div role="group" aria-label="Content kind" class="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={!pagesOnly() && kind() === "posts" ? "secondary" : "ghost"}
            aria-pressed={!pagesOnly() && kind() === "posts" ? "true" : "false"}
            onClick={() => switchKind("posts")}
          >
            Posts
          </Button>
          <Show
            when={sophieMode()}
            fallback={
              <Button
                type="button"
                size="sm"
                variant={kind() === "works" ? "secondary" : "ghost"}
                aria-pressed={kind() === "works" ? "true" : "false"}
                onClick={() => switchKind("works")}
              >
                Works
              </Button>
            }
          >
            <Button
              type="button"
              size="sm"
              variant={pagesOnly() ? "secondary" : "ghost"}
              aria-pressed={pagesOnly() ? "true" : "false"}
              onClick={() => switchKind("posts", true)}
            >
              Pages
            </Button>
          </Show>
        </div>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => props.onEdit(kind(), null)}
        >
          New
        </Button>
      </div>
      <Show when={error()}>{(message) => <Banner variant="error" description={message()} />}</Show>
      <Show when={loading()}>
        <p class="flex items-center gap-2">
          <Loader size="sm" /> Loading…
        </p>
      </Show>
      <Show when={!loading()}>
        <Show when={rows().length > 0} fallback={<p>Nothing here yet.</p>}>
          <ul class="content-rows">
            <For each={rows()}>
              {(row) => (
                <li class="content-row">
                  <button
                    type="button"
                    class="row-button"
                    onClick={() => props.onEdit(kind(), row.slug)}
                  >
                    <span class="row-title">{row.title}</span>
                    <span class="flex items-center gap-2">
                      <Badge variant={row.status === "published" ? "success" : "secondary"}>
                        {row.status}
                      </Badge>
                      <span class="row-meta">{row.slug}</span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary-destructive"
                    aria-label={`Delete ${row.slug}`}
                    onClick={() => onDelete(row.slug)}
                  >
                    Delete
                  </Button>
                </li>
              )}
            </For>
          </ul>
          <Show when={pageCount() > 1}>
            <Pagination
              class="mt-4"
              page={page()}
              pageCount={pageCount()}
              onChange={(next) => load(kind(), next, pagesOnly())}
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
};

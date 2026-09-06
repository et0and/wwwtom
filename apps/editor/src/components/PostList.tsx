import { For, Show, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsError } from "@tom/types/errors";
import type { CmsListResponse, CmsPost, CmsWork } from "@tom/schemas/cms";
import { Button } from "@tom/ui/tomui/button";
import { Badge } from "@tom/ui/tomui/badge";
import { Banner } from "@tom/ui/tomui/banner";
import { Loader } from "@tom/ui/tomui/loader";
import { Pagination } from "@tom/ui/tomui/pagination";
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
 * so refresh and back navigation restore the same list.
 */
export const PostList = (props: { onEdit: (kind: ContentKind, slug: string | null) => void }) => {
  const initialParams = () => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind") === "works" ? "works" : "posts";
    const page = Number(params.get("page"));
    return { kind, page: Number.isInteger(page) && page > 0 ? page : 1 } satisfies {
      kind: ContentKind;
      page: number;
    };
  };
  const initial = initialParams();
  const [kind, setKind] = createSignal(initial.kind);
  const [page, setPage] = createSignal(initial.page);
  const [pageCount, setPageCount] = createSignal(1);
  const [rows, setRows] = createSignal<ReadonlyArray<ContentRow>>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | undefined>(undefined);

  const writeParams = (nextKind: ContentKind, nextPage: number): void => {
    const params = new URLSearchParams(window.location.search);
    params.set("kind", nextKind);
    params.set("page", String(nextPage));
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const loadPage = (next: ContentKind, nextPage: number): Effect.Effect<void, CmsError> => {
    const list: Effect.Effect<CmsListResponse<CmsPost> | CmsListResponse<CmsWork>, CmsError> =
      next === "posts" ? listPosts(nextPage) : listWorks(nextPage);
    return list.pipe(
      Effect.map((list) => ({
        rows: list.docs.map(toRow),
        pages: Math.max(1, list.totalPages),
      })),
      Effect.flatMap((loaded): Effect.Effect<void, CmsError> => {
        const safePage = Math.min(nextPage, loaded.pages);
        if (safePage !== nextPage) return loadPage(next, safePage);
        if (loaded.rows.length === 0 && safePage > 1) return loadPage(next, safePage - 1);
        return Effect.sync(() => {
          setRows(loaded.rows);
          setPageCount(loaded.pages);
          setPage(safePage);
          writeParams(next, safePage);
          setLoading(false);
        });
      }),
    );
  };

  const load = (next: ContentKind, nextPage: number): void => {
    setLoading(true);
    setError(undefined);
    void runClient(
      loadPage(next, nextPage).pipe(
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
    load(kind(), page());
    const onPopState = (): void => {
      const restored = initialParams();
      setKind(restored.kind);
      load(restored.kind, restored.page);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  });

  const switchKind = (next: ContentKind): void => {
    setKind(next);
    load(next, 1);
  };

  const onDelete = (slug: string): void => {
    if (!window.confirm(`Delete ${slug}?`)) return;
    const current = kind();
    void runClient(
      (current === "posts" ? deletePost(slug) : deleteWork(slug)).pipe(
        Effect.tap(() => Effect.sync(() => load(current, page()))),
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
            variant={kind() === "posts" ? "secondary" : "ghost"}
            aria-pressed={kind() === "posts" ? "true" : "false"}
            onClick={() => switchKind("posts")}
          >
            Posts
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind() === "works" ? "secondary" : "ghost"}
            aria-pressed={kind() === "works" ? "true" : "false"}
            onClick={() => switchKind("works")}
          >
            Works
          </Button>
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
              onChange={(next) => load(kind(), next)}
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
};

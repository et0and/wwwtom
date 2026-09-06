import { For, Show, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsError } from "@tom/types/errors";
import type { CmsListResponse, CmsPost, CmsWork } from "@tom/schemas/cms";
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
 * so drafts show alongside published rows.
 */
export const PostList = (props: { onEdit: (kind: ContentKind, slug: string | null) => void }) => {
  const [kind, setKind] = createSignal<ContentKind>("posts");
  const [rows, setRows] = createSignal<ReadonlyArray<ContentRow>>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | undefined>(undefined);

  const load = (next: ContentKind): void => {
    setLoading(true);
    setError(undefined);
    const list: Effect.Effect<CmsListResponse<CmsPost> | CmsListResponse<CmsWork>, CmsError> =
      next === "posts" ? listPosts() : listWorks();
    void runClient(
      list.pipe(
        Effect.map((list) => list.docs.map(toRow)),
        Effect.tap((nextRows) => Effect.sync(() => setRows(nextRows))),
        Effect.tap(() => Effect.sync(() => setLoading(false))),
        Effect.catch((cause) =>
          Effect.sync(() => {
            setError(cause.message);
            setLoading(false);
          }),
        ),
      ),
    );
  };

  onSettled(() => load(kind()));

  const switchKind = (next: ContentKind): void => {
    setKind(next);
    load(next);
  };

  const onDelete = (slug: string): void => {
    if (!window.confirm(`Delete ${slug}?`)) return;
    const current = kind();
    void runClient(
      (current === "posts" ? deletePost(slug) : deleteWork(slug)).pipe(
        Effect.tap(() => Effect.sync(() => load(current))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  return (
    <div class="content-list">
      <div class="content-list-header">
        <div role="group" aria-label="Content kind">
          <button
            type="button"
            class={kind() === "posts" ? "kind-button on" : "kind-button"}
            onClick={() => switchKind("posts")}
          >
            Posts
          </button>
          <button
            type="button"
            class={kind() === "works" ? "kind-button on" : "kind-button"}
            onClick={() => switchKind("works")}
          >
            Works
          </button>
        </div>
        <button type="button" class="new-button" onClick={() => props.onEdit(kind(), null)}>
          New
        </button>
      </div>
      <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
      <Show when={loading()}>
        <p>Loading…</p>
      </Show>
      <Show when={!loading()}>
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
                  <span class="row-meta">
                    {row.status} · {row.slug}
                  </span>
                </button>
                <button
                  type="button"
                  class="delete-button"
                  aria-label={`Delete ${row.slug}`}
                  onClick={() => onDelete(row.slug)}
                >
                  Delete
                </button>
              </li>
            )}
          </For>
        </ul>
        <Show when={rows().length === 0}>
          <p>Nothing here yet.</p>
        </Show>
      </Show>
    </div>
  );
};

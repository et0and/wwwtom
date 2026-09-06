import { For, Show, createMemo, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsMedia, CmsMediaUsage } from "@tom/schemas/cms";
import { Button } from "@tom/ui/tomui/button";
import { Input } from "@tom/ui/tomui/input";
import { Banner } from "@tom/ui/tomui/banner";
import { adapterUrl, runClient } from "../lib/api";
import { deleteMedia, getMediaUsage, listMedia, mediaFileName, mediaFileUrl } from "../lib/content";
import type { ContentKind } from "../lib/content";

const UsageList = (props: {
  usage: CmsMediaUsage | undefined;
  onEdit: (kind: ContentKind, slug: string) => void;
}) => (
  <Show when={props.usage} fallback={<p class="history-meta">Loading…</p>}>
    {(found) => (
      <Show
        when={found().posts.length + found().works.length > 0}
        fallback={<p class="history-meta">Nothing uses this asset.</p>}
      >
        <div class="media-usage">
          <For each={found().posts}>
            {(post) => (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => props.onEdit("posts", post.slug)}
              >
                Post: {post.title}
              </Button>
            )}
          </For>
          <For each={found().works}>
            {(work) => (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => props.onEdit("works", work.slug)}
              >
                Work: {work.title}
              </Button>
            )}
          </For>
        </div>
      </Show>
    )}
  </Show>
);

/**
 * Media browser: newest-first grid with filename search. Usage loads
 * per asset on demand; delete confirms with the referencing titles.
 */
export const MediaView = (props: { onEdit: (kind: ContentKind, slug: string) => void }) => {
  const [items, setItems] = createSignal<ReadonlyArray<CmsMedia>>([]);
  const [query, setQuery] = createSignal("");
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [usage, setUsage] = createSignal<Record<string, CmsMediaUsage>>({});
  const [openUsage, setOpenUsage] = createSignal<string | undefined>(undefined);

  const reload = (): void => {
    void runClient(
      listMedia().pipe(
        Effect.tap((list) => Effect.sync(() => setItems(list.docs))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  onSettled(reload);

  const visible = createMemo(() => {
    const needle = query().trim().toLowerCase();
    const all = items();
    return needle === ""
      ? all
      : all.filter((item) => mediaFileName(item.key).toLowerCase().includes(needle));
  });

  const toggleUsage = (id: string): void => {
    if (openUsage() === id) {
      setOpenUsage(undefined);
      return;
    }
    setOpenUsage(id);
    if (usage()[id] !== undefined) return;
    void runClient(
      getMediaUsage(id).pipe(
        Effect.tap((found) => Effect.sync(() => setUsage((prev) => ({ ...prev, [id]: found })))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  const onDelete = (item: CmsMedia): void => {
    const found = usage()[item.id];
    const names =
      found === undefined
        ? []
        : [...found.posts.map((post) => post.title), ...found.works.map((work) => work.title)];
    const where = names.length > 0 ? ` Used in: ${names.join(", ")}.` : "";
    if (!window.confirm(`Delete ${mediaFileName(item.key)}?${where}`)) return;
    void runClient(
      deleteMedia(item.id).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            setItems((prev) => prev.filter((current) => current.id !== item.id));
            setOpenUsage(undefined);
          }),
        ),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  return (
    <div class="media-view">
      <div class="media-layout">
        <aside class="media-sidebar">
          <label class="field">
            Search media
            <Input
              type="text"
              value={query()}
              placeholder="Filter by filename"
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <Show when={error()}>
            {(message) => <Banner variant="error" description={message()} />}
          </Show>
        </aside>
        <section class="media-results">
          <Show
            when={visible().length > 0}
            fallback={<p class="history-empty">No media yet — upload from a post or work.</p>}
          >
            <div class="media-grid">
              <For each={visible()}>
                {(item) => (
                  <div class="media-card">
                    <Show
                      when={item.mime.startsWith("video/")}
                      fallback={
                        <img
                          class="media-thumb"
                          src={mediaFileUrl(adapterUrl(), item.id)}
                          alt={item.alt ?? ""}
                          loading="lazy"
                        />
                      }
                    >
                      <video
                        class="media-thumb"
                        src={mediaFileUrl(adapterUrl(), item.id)}
                        muted
                        preload="metadata"
                      />
                    </Show>
                    <p class="media-name">{mediaFileName(item.key)}</p>
                    <div class="media-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleUsage(item.id)}
                      >
                        {openUsage() === item.id ? "Hide usage" : "Usage"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary-destructive"
                        onClick={() => onDelete(item)}
                      >
                        Delete
                      </Button>
                    </div>
                    <Show when={openUsage() === item.id}>
                      <UsageList usage={usage()[item.id]} onEdit={props.onEdit} />
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </div>
  );
};

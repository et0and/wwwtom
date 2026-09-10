import { For, Show, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsPost, CmsRevisionMeta, CmsRevisionSnapshot, CmsWork } from "@tom/schemas/cms";
import { renderTiptapHtml } from "@tom/utils/tiptap-html";
import { Button } from "@tom/ui/button";
import { Badge } from "@tom/ui/badge";
import { Banner } from "@tom/ui/banner";
import { Loader } from "@tom/ui/loader";
import { adapterUrl, runClient } from "../lib/api";
import { getRevision, listRevisions, mediaFileUrl, restoreRevision } from "../lib/content";
import type { ContentKind } from "../lib/content";

type Selected = {
  readonly meta: CmsRevisionMeta;
  readonly snapshot: CmsRevisionSnapshot;
  readonly html: string;
};

const formatWhen = (iso: string): string => {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? iso : new Date(time).toLocaleString();
};

const noop = (): void => undefined;

/**
 * Revision history for a saved post/work: newest-first entries with a
 * snapshot preview and restore. Restoring replays the snapshot through the
 * normal save path, so the pre-restore state stays in history too.
 * `onReload` hands the list reload to the parent so saves refresh an open
 * panel; the cleanup revokes it on unmount.
 */
export const HistoryPanel = (props: {
  kind: ContentKind;
  slug: string;
  onRestored: (saved: CmsPost | CmsWork) => void;
  onReload: (reload: () => void) => void;
}) => {
  const [revisions, setRevisions] = createSignal<ReadonlyArray<CmsRevisionMeta>>([]);
  const [selected, setSelected] = createSignal<Selected | undefined>(undefined);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [restoring, setRestoring] = createSignal(false);

  const mediaUrl = (mediaId: string): string => mediaFileUrl(adapterUrl(), mediaId);

  const reloadList = (): void => {
    void runClient(
      listRevisions(props.kind, props.slug).pipe(
        Effect.tap((entries) => Effect.sync(() => setRevisions(entries))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  onSettled(() => {
    props.onReload(reloadList);
    reloadList();
    return () => props.onReload(noop);
  });

  const onSelect = (meta: CmsRevisionMeta): void => {
    setError(undefined);
    void runClient(
      getRevision(props.kind, props.slug, meta.id).pipe(
        Effect.flatMap((snapshot) =>
          Effect.map(renderTiptapHtml(snapshot.content, mediaUrl), (html) => ({
            meta,
            snapshot,
            html,
          })),
        ),
        Effect.tap((next) => Effect.sync(() => setSelected(next))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  const onRestore = (): void => {
    const current = selected();
    if (!current || !window.confirm(`Restore "${current.meta.title}"?`)) return;
    setRestoring(true);
    void runClient(
      restoreRevision(props.kind, props.slug, current.meta.id).pipe(
        Effect.tap((saved) =>
          Effect.sync(() => {
            setRestoring(false);
            setSelected(undefined);
            props.onRestored(saved);
            reloadList();
          }),
        ),
        Effect.catch((cause) =>
          Effect.sync(() => {
            setRestoring(false);
            setError(cause.message);
          }),
        ),
      ),
    );
  };

  return (
    <div class="history-panel">
      <h2>History</h2>
      <Show when={error()}>{(message) => <Banner variant="error" description={message()} />}</Show>
      <Show
        when={revisions().length > 0}
        fallback={<p class="history-empty">No revisions yet — save to create one.</p>}
      >
        <div class="history-rows">
          <For each={revisions()}>
            {(meta) => (
              <Button
                type="button"
                size="sm"
                variant={selected()?.meta.id === meta.id ? "secondary" : "ghost"}
                class="w-full justify-between"
                onClick={() => onSelect(meta)}
              >
                <span class="history-title">{meta.title}</span>
                <span class="history-meta">
                  {formatWhen(meta.createdAt)}
                  {meta.actor === null ? "" : ` · ${meta.actor}`}
                </span>
              </Button>
            )}
          </For>
        </div>
      </Show>
      <Show when={selected()}>
        {(current) => (
          <div class="history-preview">
            <p class="flex items-center gap-2">
              <Badge variant="secondary">{current().snapshot.status}</Badge>
              <span class="history-meta">{formatWhen(current().meta.createdAt)}</span>
            </p>
            <div class="preview" innerHTML={current().html} />
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={restoring()}
              disabled={restoring()}
              onClick={onRestore}
            >
              {restoring() ? "Restoring…" : "Restore this version"}
            </Button>
          </div>
        )}
      </Show>
      <Show when={restoring()}>
        <p class="flex items-center gap-2">
          <Loader size="sm" /> Restoring…
        </p>
      </Show>
    </div>
  );
};

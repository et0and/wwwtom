import { For, Show, createMemo, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsMedia } from "@tom/schemas/cms";
import { Input } from "@tom/ui/tomui/input";
import { Banner } from "@tom/ui/tomui/banner";
import { adapterUrl, runClient } from "../lib/api";
import { listMedia, mediaFileName, mediaFileUrl } from "../lib/content";

/**
 * Existing-asset picker for the editor insert flow. Loads newest-first on
 * mount (the panel remounts per open, so the list stays fresh) and filters
 * by filename locally.
 */
export const MediaPicker = (props: { onPick: (item: CmsMedia) => void }) => {
  const [items, setItems] = createSignal<ReadonlyArray<CmsMedia>>([]);
  const [query, setQuery] = createSignal("");
  const [error, setError] = createSignal<string | undefined>(undefined);

  onSettled(() => {
    void runClient(
      listMedia().pipe(
        Effect.tap((list) => Effect.sync(() => setItems(list.docs))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  });

  const visible = createMemo(() => {
    const needle = query().trim().toLowerCase();
    const all = items();
    return needle === ""
      ? all
      : all.filter((item) => mediaFileName(item.key).toLowerCase().includes(needle));
  });

  return (
    <div class="media-picker">
      <label class="field">
        Choose existing
        <Input
          type="text"
          value={query()}
          placeholder="Search by filename"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <Show when={error()}>{(message) => <Banner variant="error" description={message()} />}</Show>
      <Show when={visible().length > 0} fallback={<p class="history-meta">No matching media.</p>}>
        <div class="media-grid">
          <For each={visible()}>
            {(item) => (
              <button type="button" class="media-pick" onClick={() => props.onPick(item)}>
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
                <span class="media-name">{mediaFileName(item.key)}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

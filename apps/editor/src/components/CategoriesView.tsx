import { For, Show, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsCategory } from "@tom/schemas/cms";
import { createCategory, deleteCategory, listCategories } from "../lib/content";
import { runClient } from "../lib/api";

/** Category manager: list, add, delete. Posts link by id from the edit view. */
export const CategoriesView = (props: { onBack: () => void }) => {
  const [categories, setCategories] = createSignal<ReadonlyArray<CmsCategory>>([]);
  const [slug, setSlug] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [error, setError] = createSignal<string | undefined>(undefined);

  const load = (): void => {
    void runClient(
      listCategories().pipe(
        Effect.tap((items) => Effect.sync(() => setCategories(items))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  onSettled(load);

  const onAdd = (): void => {
    setError(undefined);
    void runClient(
      createCategory(slug(), title()).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            setSlug("");
            setTitle("");
            load();
          }),
        ),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  const onDelete = (slug: string): void => {
    if (!window.confirm(`Delete category ${slug}?`)) return;
    void runClient(
      deleteCategory(slug).pipe(
        Effect.tap(() => Effect.sync(load)),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  };

  return (
    <div class="categories-view">
      <button type="button" class="back-button" onClick={props.onBack}>
        ← Back
      </button>
      <h2>Categories</h2>
      <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
      <ul class="content-rows">
        <For each={categories()}>
          {(category) => (
            <li class="content-row">
              <span class="row-title">
                {category.title} · {category.slug}
              </span>
              <button
                type="button"
                class="delete-button"
                aria-label={`Delete category ${category.slug}`}
                onClick={() => onDelete(category.slug)}
              >
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
      <div class="panel">
        <label class="field">
          Slug
          <input
            type="text"
            value={slug()}
            onInput={(event) => setSlug(event.currentTarget.value)}
          />
        </label>
        <label class="field">
          Title
          <input
            type="text"
            value={title()}
            onInput={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <button type="button" class="back-button" onClick={onAdd}>
          Add category
        </button>
      </div>
    </div>
  );
};

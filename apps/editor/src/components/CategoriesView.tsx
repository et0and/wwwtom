import { For, Show, createSignal, onSettled } from "solid-js";
import { Effect } from "effect";
import type { CmsCategory } from "@tom/schemas/cms";
import { Button } from "@tom/ui/tomui/button";
import { Input } from "@tom/ui/tomui/input";
import { Banner } from "@tom/ui/tomui/banner";
import { createCategory, deleteCategory, listCategories } from "../lib/content";
import { runClient } from "../lib/api";

/** Category manager: list, add, delete. Posts link by id from the edit view. */
export const CategoriesView = () => {
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
      <h2>Categories</h2>
      <Show when={error()}>{(message) => <Banner variant="error" description={message()} />}</Show>
      <div class="categories-layout">
        <section class="categories-list">
          <ul class="content-rows">
            <For each={categories()}>
              {(category) => (
                <li class="content-row">
                  <span class="row-title">
                    {category.title} · {category.slug}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary-destructive"
                    aria-label={`Delete category ${category.slug}`}
                    onClick={() => onDelete(category.slug)}
                  >
                    Delete
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </section>
        <aside class="categories-form">
          <div class="panel">
            <label class="field">
              Slug
              <Input
                type="text"
                value={slug()}
                onInput={(event) => setSlug(event.currentTarget.value)}
              />
            </label>
            <label class="field">
              Title
              <Input
                type="text"
                value={title()}
                onInput={(event) => setTitle(event.currentTarget.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              class="justify-self-start"
              onClick={onAdd}
            >
              Add category
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
};

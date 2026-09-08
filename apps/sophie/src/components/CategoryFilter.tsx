import { For, Show } from "solid-js";
import type { CmsCategory } from "@tom/schemas/cms";

export const CategoryFilter = (props: {
  categories: ReadonlyArray<CmsCategory>;
  active: string | null;
  onSelect: (slug: string | null) => void;
}) => (
  <div class="flex flex-wrap gap-2 py-4">
    <button
      type="button"
      class="sophie-filter"
      aria-pressed={props.active === null ? "true" : "false"}
      onClick={() => props.onSelect(null)}
    >
      All
    </button>
    <For each={props.categories}>
      {(category) => (
        <button
          type="button"
          class="sophie-filter"
          aria-pressed={props.active === category.slug ? "true" : "false"}
          onClick={() => props.onSelect(category.slug)}
        >
          {category.title}
        </button>
      )}
    </For>
    <Show when={props.categories.length === 0}>
      <span class="sophie-meta">No categories yet.</span>
    </Show>
  </div>
);

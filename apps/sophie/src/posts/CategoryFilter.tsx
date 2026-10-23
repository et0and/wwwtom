import * as stylex from "@stylexjs/stylex";
import { For, Show } from "solid-js";
import { layout, spacing } from "@tom/ui/primitives.stylex";
import type { CmsCategory } from "@tom/schemas/cms";

export const CategoryFilter = (props: {
  categories: ReadonlyArray<CmsCategory>;
  active: string | null;
  onSelect: (slug: string | null) => void;
}) => (
  <div {...stylex.attrs(layout.flexWrapRow, layout.gap2, spacing.py4)}>
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

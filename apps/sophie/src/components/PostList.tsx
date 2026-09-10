import { For, Show } from "solid-js";
import type { CmsPost } from "@tom/schemas/cms";
import { formatPublishedDateTime } from "../lib/posts";

export const PostList = (props: { posts: ReadonlyArray<CmsPost> }) => (
  <Show when={props.posts.length > 0} fallback={<p>No posts yet.</p>}>
    <For each={props.posts}>
      {(post) => (
        <a href={`/posts/${post.slug}`} class="sophie-post">
          <h2>{post.title}</h2>
          <p class="sophie-meta">{formatPublishedDateTime(post.publishedAt)}</p>
          <Show when={post.categories.length > 0}>
            <p class="sophie-meta">
              <For each={post.categories}>
                {(category, index) => (
                  <span>
                    {index() > 0 ? ", " : ""}
                    {category.title}
                  </span>
                )}
              </For>
            </p>
          </Show>
        </a>
      )}
    </For>
  </Show>
);

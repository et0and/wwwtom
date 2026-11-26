import { Head } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";

import { Posts } from "../Posts";

export const PostsPage = Html.component({
  name: "PostsPage",
  model: Schema.Null,
  message: Schema.Never,
  queries: {
    posts: { query: Posts, args: () => ({}) },
  },
}).make({
  init: () => null,
  update: ($) => $.model,
  head: () => [Head.title("Posts")],
  view: (h) =>
    h.main.children(
      h.h1.children("Posts"),
      AsyncResult.match(h.queries.posts, {
        onInitial: () => h.p.children("Loading posts..."),
        onFailure: () => h.p.children("Failed to load posts"),
        onSuccess: ({ value }) =>
          h.ul.children(value.map((post) => h.li.children(`${post.title} - ${post.summary}`))),
      }),
    ),
});

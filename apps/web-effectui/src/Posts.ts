import { Query } from "@effect/ui";
import { Effect, Schema } from "effect";

export const Post = Schema.Struct({
  slug: Schema.String,
  title: Schema.String,
  summary: Schema.String,
});

/** A fixture fetcher: the spike proves SSR query state, not adapter access. */
export class Posts extends Query.Service<Posts>()("Posts", {
  args: {},
  success: Schema.Array(Post),
  error: Schema.String,
  staleTime: "5 minutes",
}) {}

export const PostsLayer = Posts.toLayer(() =>
  Effect.succeed([
    {
      slug: "hello",
      title: "Hello",
      summary: "The first post.",
    },
    {
      slug: "second",
      title: "Second",
      summary: "Another post.",
    },
  ]),
);

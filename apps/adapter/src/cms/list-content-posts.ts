import { Elysia } from "elysia";
import {
  POSTS_PAGE_SIZE,
  postQuerySchema,
  proxyCachedCms,
  sessionHeaders,
  toUpstreamQuery,
} from "./shared";

export const listPostsRoute = new Elysia().get(
  "/content/posts",
  async ({ query, request, set }) =>
    proxyCachedCms(request, set, "posts", (api) =>
      api.posts.get({
        query: {
          page: query.page ?? 1,
          pageSize: query.pageSize ?? POSTS_PAGE_SIZE,
          ...toUpstreamQuery(query),
        },
        headers: sessionHeaders(request),
      }),
    ),
  {
    query: postQuerySchema,
    detail: { description: "List posts (drafts need a session)", tags: ["cms"] },
  },
);

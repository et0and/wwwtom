import { Elysia } from "elysia";
import {
  POSTS_PAGE_SIZE,
  postQuerySchema,
  proxyCachedCms,
  sessionHeaders,
  toUpstreamQuery,
} from "./shared";

export const listPostSummariesRoute = new Elysia().get(
  // Static before dynamic: "/content/posts/summary" must not read as a slug.
  "/content/posts/summary",
  async ({ query, request, set }) =>
    proxyCachedCms(request, set, "post summaries", (api) =>
      api.posts.summary.get({
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
    detail: {
      description: "List post summaries, no body (drafts need a session)",
      tags: ["cms"],
    },
  },
);

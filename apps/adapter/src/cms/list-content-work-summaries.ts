import { Elysia } from "elysia";
import {
  postQuerySchema,
  proxyCachedCms,
  rejectWorkCategory,
  sessionHeaders,
  toUpstreamQuery,
  WORKS_PAGE_SIZE,
} from "./shared";

export const listWorkSummariesRoute = new Elysia().get(
  // Static before dynamic: "/content/works/summary" must not read as a slug.
  "/content/works/summary",
  async ({ query, request, set }) => {
    rejectWorkCategory(query);
    return proxyCachedCms(request, set, "work summaries", (api) =>
      api.works.summary.get({
        query: {
          page: query.page ?? 1,
          pageSize: query.pageSize ?? WORKS_PAGE_SIZE,
          ...toUpstreamQuery(query),
        },
        headers: sessionHeaders(request),
      }),
    );
  },
  {
    query: postQuerySchema,
    detail: {
      description: "List work summaries, no body (drafts need a session)",
      tags: ["cms"],
    },
  },
);

import { Elysia } from "elysia";
import {
  postQuerySchema,
  proxyCachedCms,
  rejectWorkCategory,
  sessionHeaders,
  toUpstreamQuery,
  WORKS_PAGE_SIZE,
} from "./shared";

export const listWorksRoute = new Elysia().get(
  "/content/works",
  async ({ query, request, set }) => {
    rejectWorkCategory(query);
    return proxyCachedCms(request, set, "works", (api) =>
      api.works.get({
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
    detail: { description: "List works (drafts need a session)", tags: ["cms"] },
  },
);

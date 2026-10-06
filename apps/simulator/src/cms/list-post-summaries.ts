import { Elysia } from "elysia";
import { byPublishedDesc, listQuery, listResponse, postSummaries } from "./data";

export const listPostSummariesRoute = new Elysia().get(
  "/posts/summary",
  ({ query }) =>
    listResponse(
      postSummaries,
      query.page ?? 1,
      query.pageSize ?? query.limit ?? 10,
      byPublishedDesc,
    ),
  {
    query: listQuery,
    detail: { description: "Simulated CMS post summaries, no body", tags: ["cms"] },
  },
);

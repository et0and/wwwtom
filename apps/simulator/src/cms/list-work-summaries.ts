import { Elysia } from "elysia";
import { byTitleAsc, listQuery, listResponse, workSummaries } from "./data";

export const listWorkSummariesRoute = new Elysia().get(
  "/works/summary",
  ({ query }) =>
    listResponse(workSummaries, query.page ?? 1, query.pageSize ?? query.limit ?? 10, byTitleAsc),
  {
    query: listQuery,
    detail: { description: "Simulated CMS work summaries, no body", tags: ["cms"] },
  },
);

import { Elysia } from "elysia";
import { byTitleAsc, listQuery, listResponse, works } from "./data";

export const listWorksRoute = new Elysia().get(
  "/works",
  ({ query }) =>
    listResponse(works, query.page ?? 1, query.pageSize ?? query.limit ?? 10, byTitleAsc),
  {
    query: listQuery,
    detail: { description: "Simulated CMS works", tags: ["cms"] },
  },
);

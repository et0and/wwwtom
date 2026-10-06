import { Elysia } from "elysia";
import { byPublishedDesc, listQuery, listResponse, posts } from "./data";

export const listPostsRoute = new Elysia().get(
  "/posts",
  ({ query }) =>
    listResponse(posts, query.page ?? 1, query.pageSize ?? query.limit ?? 10, byPublishedDesc),
  {
    query: listQuery,
    detail: { description: "Simulated CMS posts", tags: ["cms"] },
  },
);

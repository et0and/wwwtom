import { Elysia } from "elysia";
import { listPosts } from "./operations";
import { cmsListQuerySchema, runListQuery } from "./shared";

export const listPostsRoute = new Elysia().get(
  "/posts",
  ({ query, request }) => runListQuery(request, query, "list_posts", true, listPosts),
  {
    query: cmsListQuerySchema,
    detail: { description: "List posts (drafts need a session)", tags: ["cms"] },
  },
);

import { Elysia } from "elysia";
import { authoredGetRoute, SlugParamsSchema } from "./shared";

export const listPostRevisionsRoute = new Elysia().get(
  "/content/posts/:slug/revisions",
  authoredGetRoute,
  {
    params: SlugParamsSchema,
    detail: { description: "List a post's revisions (session required)", tags: ["cms"] },
  },
);

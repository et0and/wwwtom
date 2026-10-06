import { Elysia } from "elysia";
import { authoredGetRoute, RevisionParamsSchema } from "./shared";

export const getPostRevisionRoute = new Elysia().get(
  "/content/posts/:slug/revisions/:revId",
  authoredGetRoute,
  {
    params: RevisionParamsSchema,
    detail: { description: "Get a post revision snapshot (session required)", tags: ["cms"] },
  },
);

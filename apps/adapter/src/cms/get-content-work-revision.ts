import { Elysia } from "elysia";
import { authoredGetRoute, RevisionParamsSchema } from "./shared";

export const getWorkRevisionRoute = new Elysia().get(
  "/content/works/:slug/revisions/:revId",
  authoredGetRoute,
  {
    params: RevisionParamsSchema,
    detail: { description: "Get a work revision snapshot (session required)", tags: ["cms"] },
  },
);

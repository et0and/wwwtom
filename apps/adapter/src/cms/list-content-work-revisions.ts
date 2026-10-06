import { Elysia } from "elysia";
import { authoredGetRoute, SlugParamsSchema } from "./shared";

export const listWorkRevisionsRoute = new Elysia().get(
  "/content/works/:slug/revisions",
  authoredGetRoute,
  {
    params: SlugParamsSchema,
    detail: { description: "List a work's revisions (session required)", tags: ["cms"] },
  },
);

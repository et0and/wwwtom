import { Elysia } from "elysia";
import { findPublished, single, slugParams, works } from "./data";

export const getWorkRoute = new Elysia().get(
  "/works/:slug",
  ({ params, set }) => single(findPublished(works, params.slug), set),
  {
    params: slugParams,
    detail: { description: "Simulated CMS work by slug", tags: ["cms"] },
  },
);

import { Elysia } from "elysia";
import { findPublished, posts, single, slugParams } from "./data";

export const getPostRoute = new Elysia().get(
  "/posts/:slug",
  ({ params, set }) => single(findPublished(posts, params.slug), set),
  {
    params: slugParams,
    detail: { description: "Simulated CMS post by slug", tags: ["cms"] },
  },
);

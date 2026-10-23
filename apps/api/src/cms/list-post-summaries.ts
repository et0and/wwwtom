import { Elysia } from "elysia";
import { listPostSummaries } from "./operations";
import { cmsListQuerySchema, runListQuery } from "./shared";

export const listPostSummariesRoute = new Elysia().get(
  // Static before dynamic: "/posts/summary" must not read as a slug.
  "/posts/summary",
  ({ query, request }) =>
    runListQuery(request, query, "list_post_summaries", true, listPostSummaries),
  {
    query: cmsListQuerySchema,
    detail: {
      description: "List post summaries, no body (drafts need a session)",
      tags: ["cms"],
    },
  },
);

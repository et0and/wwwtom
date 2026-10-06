import { Elysia } from "elysia";
import { listWorkSummaries } from "./operations";
import { cmsListQuerySchema, runListQuery } from "./shared";

export const listWorkSummariesRoute = new Elysia().get(
  // Static before dynamic: "/works/summary" must not read as a slug.
  "/works/summary",
  ({ query, request }) =>
    runListQuery(request, query, "list_work_summaries", false, listWorkSummaries),
  {
    query: cmsListQuerySchema,
    detail: {
      description: "List work summaries, no body (drafts need a session)",
      tags: ["cms"],
    },
  },
);

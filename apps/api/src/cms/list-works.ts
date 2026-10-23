import { Elysia } from "elysia";
import { listWorks } from "./operations";
import { cmsListQuerySchema, runListQuery } from "./shared";

export const listWorksRoute = new Elysia().get(
  "/works",
  ({ query, request }) => runListQuery(request, query, "list_works", false, listWorks),
  {
    query: cmsListQuerySchema,
    detail: { description: "List works (drafts need a session)", tags: ["cms"] },
  },
);

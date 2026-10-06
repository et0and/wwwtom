import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { runArena, searchQuerySchema, toPaginationAttributes } from "./shared";

export const searchRoute = new Elysia().get(
  "/arena/search",
  ({ query, request }) => {
    return runArena(
      request,
      (client) => {
        const searchers = {
          everything: client.search.everything,
          channels: client.search.channels,
          blocks: client.search.blocks,
          users: client.search.users,
        };
        return searchers[query.type ?? "everything"](query.query, toPaginationAttributes(query));
      },
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    query: searchQuerySchema,
    detail: { description: "Search Are.na", tags: ["arena"] },
  },
);

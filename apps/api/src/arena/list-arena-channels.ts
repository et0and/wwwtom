import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { paginationQuerySchema, runArena, toPaginationAttributes } from "./shared";

export const listChannelsRoute = new Elysia().get(
  "/internal/arena/channels",
  ({ query, request }) => {
    return runArena(
      request,
      (client) => client.channels(toPaginationAttributes(query)),
      logContextFromRequest(request, "tom-api"),
    );
  },
  {
    query: paginationQuerySchema,
    detail: { description: "List channels (authenticated)", tags: ["arena"] },
  },
);

import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import {
  IdOrSlugParamsSchema,
  paginationQuerySchema,
  runArena,
  toPaginationAttributes,
} from "./shared";

export const getUserChannelsRoute = new Elysia().get(
  "/arena/users/:id/channels",
  ({ params, query, request }) => {
    return runArena(
      request,
      (client) => client.user(params.id).channels(toPaginationAttributes(query)),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: IdOrSlugParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get a user's channels", tags: ["arena"] },
  },
);

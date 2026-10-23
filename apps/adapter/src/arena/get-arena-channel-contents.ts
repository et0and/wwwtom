import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import {
  ChannelSlugParamsSchema,
  paginationQuerySchema,
  runArena,
  toPaginationAttributes,
} from "./shared";

export const getChannelContentsRoute = new Elysia().get(
  "/arena/channels/:slug/contents",
  ({ params, query, request }) => {
    return runArena(
      request,
      (client) => client.channel(params.slug).contents(toPaginationAttributes(query)),
      logContextFromRequest(request, "tom-adapter"),
      "public",
    );
  },
  {
    params: ChannelSlugParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get channel contents", tags: ["arena"] },
  },
);

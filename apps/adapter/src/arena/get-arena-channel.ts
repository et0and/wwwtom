import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { ChannelSlugParamsSchema, runArena } from "./shared";

export const getChannelRoute = new Elysia().get(
  "/arena/channels/:slug",
  ({ params, request }) => {
    return runArena(
      request,
      (client) => client.channel(params.slug).get,
      logContextFromRequest(request, "tom-adapter"),
      "public",
    );
  },
  {
    params: ChannelSlugParamsSchema,
    detail: { description: "Get a channel by slug", tags: ["arena"] },
  },
);

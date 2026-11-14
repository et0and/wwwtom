import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { ChannelSlugParamsSchema, runArena } from "./shared";

export const getChannelThumbRoute = new Elysia().get(
  "/internal/arena/channels/:slug/thumb",
  ({ params, request }) => {
    return runArena(
      request,
      (client) => client.channel(params.slug).thumb,
      logContextFromRequest(request, "tom-api"),
      "public",
    );
  },
  {
    params: ChannelSlugParamsSchema,
    detail: { description: "Get channel thumbnail", tags: ["arena"] },
  },
);

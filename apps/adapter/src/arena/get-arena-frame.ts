import { Elysia } from "elysia";
import { listFrameImages } from "@tom/arena/content";
import {
  ARENA_FRAME_FORMAT,
  ARENA_FRAME_HEIGHT,
  ARENA_FRAME_WIDTH,
  type ArenaFrame,
} from "@tom/schemas/arena-frame";
import { logContextFromRequest } from "@tom/utils/worker";
import { setPublicContentCache } from "../content-cache";
import { ChannelSlugParamsSchema, requireArenaTenant, runArena } from "./shared";

/** Two are.na pages, which is more than a desk frame will ever cycle. */
const FRAME_BLOCK_LIMIT = 20;

export const getArenaFrameRoute = new Elysia().get(
  "/arena/frame/:slug",
  async ({ params, request, set }) => {
    requireArenaTenant(request);
    const images = await runArena(
      request,
      (client) => listFrameImages(client, params.slug, FRAME_BLOCK_LIMIT),
      logContextFromRequest(request, "tom-adapter"),
      "public",
    );
    setPublicContentCache(request, set);
    const { origin } = new URL(request.url);
    const channel = encodeURIComponent(params.slug);
    return {
      channel: params.slug,
      width: ARENA_FRAME_WIDTH,
      height: ARENA_FRAME_HEIGHT,
      format: ARENA_FRAME_FORMAT,
      blocks: images.map((image) => ({
        id: image.id,
        title: image.title,
        imageUrl: `${origin}/arena/frame/${channel}/image/${image.id}`,
      })),
    } satisfies ArenaFrame;
  },
  {
    params: ChannelSlugParamsSchema,
    detail: {
      description: "List the image blocks a desk frame can draw for a channel",
      tags: ["arena-frame"],
    },
  },
);

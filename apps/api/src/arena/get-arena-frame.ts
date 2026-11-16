import { Elysia } from "elysia";
import { Schema } from "effect";
import { listFrameImages } from "@tom/arena/content";
import {
  ARENA_FRAME_FORMAT,
  ARENA_FRAME_HEIGHT,
  ARENA_FRAME_WIDTH,
  type ArenaFrame,
} from "@tom/schemas/arena-frame";
import { logContextFromRequest, getRequestEnv } from "@tom/utils/worker";
import { readCloudflareEnv } from "@tom/utils/config";
import { setPublicContentCache } from "./content-cache";
import { ChannelSlugParamsSchema, runArena } from "./shared";

/** One are.na page of images per deck; the firmware asks for the next page. */
const FRAME_BLOCK_LIMIT = 20;

const FrameQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.FiniteFromString),
    /** Per-boot token: a new value forces a fresh are.na read. */
    t: Schema.optional(Schema.FiniteFromString),
  }),
);

export const getArenaFrameRoute = new Elysia().get(
  "/internal/arena/frame/:slug",
  async ({ params, query, request, set }) => {
    const result = await runArena(
      request,
      (client) =>
        listFrameImages(
          client,
          params.slug,
          FRAME_BLOCK_LIMIT,
          query.page ?? 1,
          query.t === undefined ? undefined : String(query.t),
        ),
      logContextFromRequest(request, "tom-api"),
      "public",
    );
    setPublicContentCache(request, set);
    // The device talks to the adapter, not this worker: its public frame
    // routes proxy back here. Build image URLs on the adapter origin so the
    // firmware never receives an internal-only host.
    const env = await readCloudflareEnv(getRequestEnv(request));
    const origin = env.ADAPTER_URL ?? new URL(request.url).origin;
    const channel = encodeURIComponent(params.slug);
    return {
      channel: params.slug,
      page: result.page,
      hasMore: result.hasMore,
      width: ARENA_FRAME_WIDTH,
      height: ARENA_FRAME_HEIGHT,
      format: ARENA_FRAME_FORMAT,
      blocks: result.images.map((image) => ({
        id: image.id,
        title: image.title,
        imageUrl: `${origin}/arena/frame/${channel}/image/${image.id}`,
      })),
    } satisfies ArenaFrame;
  },
  {
    params: ChannelSlugParamsSchema,
    query: FrameQuerySchema,
    detail: {
      description: "List the image blocks a desk frame can draw for a channel",
      tags: ["arena-frame"],
    },
  },
);

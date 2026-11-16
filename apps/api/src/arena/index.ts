import { Elysia } from "elysia";
import { requireInternalTokenBeforeHandle } from "../internal";
import { contentFeedRoute } from "./get-content-arena-feed";
import { contentPostRoute } from "./get-content-arena-post";
import { contentPostsRoute } from "./list-content-arena-posts";
import { contentWorkRoute } from "./get-content-arena-work";
import { contentWorksRoute } from "./list-content-arena-works";
import { getBlockRoute } from "./get-arena-block";
import { getArenaFrameRoute } from "./get-arena-frame";
import { getArenaFrameImageRoute } from "./get-arena-frame-image";
import { getBlockChannelsRoute } from "./list-arena-block-channels";
import { getBlockCommentsRoute } from "./list-arena-block-comments";
import { getChannelRoute } from "./get-arena-channel";
import { getChannelContentsRoute } from "./get-arena-channel-contents";
import { getChannelThumbRoute } from "./get-arena-channel-thumb";
import { getUserRoute } from "./get-arena-user";
import { getUserChannelsRoute } from "./list-arena-user-channels";
import { getUserFollowersRoute } from "./list-arena-user-followers";
import { getUserFollowingRoute } from "./list-arena-user-following";
import { listChannelsRoute } from "./list-arena-channels";
import { searchRoute } from "./search-arena";
import { requireArenaTenant } from "./shared";

/**
 * Internal are.na reads. The adapter is the only caller: every route is
 * mounted behind the internal token and the Tom tenant gate in the app entry,
 * so are.na is never reachable from the public internet through api.tom.so.
 */
export const arenaRoutes = new Elysia({ name: "arena" })
  .use(listChannelsRoute)
  .use(getChannelRoute)
  .use(getChannelContentsRoute)
  .use(getChannelThumbRoute)
  .use(getUserRoute)
  .use(getUserChannelsRoute)
  .use(getUserFollowingRoute)
  .use(getUserFollowersRoute)
  .use(getBlockRoute)
  .use(getArenaFrameRoute)
  .use(getArenaFrameImageRoute)
  .use(getBlockChannelsRoute)
  .use(getBlockCommentsRoute)
  .use(searchRoute)
  .use(contentPostsRoute)
  .use(contentPostRoute)
  .use(contentWorksRoute)
  .use(contentWorkRoute)
  .use(contentFeedRoute);

/**
 * The adapter-facing surface: are.na reads behind the shared internal token,
 * Tom only. Sophie keeps its D1 CMS and never sees these routes.
 */
export const internalArenaRoutes = new Elysia({ name: "internal-arena" }).guard(
  { beforeHandle: requireInternalTokenBeforeHandle },
  (app) =>
    app.guard({ beforeHandle: ({ request }) => requireArenaTenant(request) }, (tom) =>
      tom.use(arenaRoutes),
    ),
);

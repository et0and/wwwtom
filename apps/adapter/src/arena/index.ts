import { Elysia } from "elysia";
import { contentFeedRoute } from "./get-content-arena-feed";
import { contentPostRoute } from "./get-content-arena-post";
import { contentPostsRoute } from "./list-content-arena-posts";
import { contentWorkRoute } from "./get-content-arena-work";
import { contentWorksRoute } from "./list-content-arena-works";
import { getBlockRoute } from "./get-arena-block";
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

export const arenaIntegration = new Elysia({ name: "arena" })
  .use(listChannelsRoute)
  .use(getChannelRoute)
  .use(getChannelContentsRoute)
  .use(getChannelThumbRoute)
  .use(getUserRoute)
  .use(getUserChannelsRoute)
  .use(getUserFollowingRoute)
  .use(getUserFollowersRoute)
  .use(getBlockRoute)
  .use(getBlockChannelsRoute)
  .use(getBlockCommentsRoute)
  .use(searchRoute)
  .use(contentPostsRoute)
  .use(contentPostRoute)
  .use(contentWorksRoute)
  .use(contentWorkRoute)
  .use(contentFeedRoute);

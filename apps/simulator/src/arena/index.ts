import { Elysia } from "elysia";
import { blockCommentsRoute } from "./list-block-comments";
import { blockConnectionsRoute } from "./list-block-connections";
import { channelContentsRoute } from "./get-channel-contents";
import { channelThumbRoute } from "./get-channel-thumb";
import { getBlockRoute } from "./get-block";
import { getChannelRoute } from "./get-channel";
import { getUserRoute } from "./get-user";
import { listChannelsRoute } from "./list-channels";
import { searchRoute } from "./get-search";
import { userChannelsRoute } from "./list-user-channels";
import { userFollowersRoute } from "./list-user-followers";
import { userFollowingRoute } from "./list-user-following";

export const arenaSimulator = new Elysia({ name: "arena-simulator" })
  .use(channelContentsRoute)
  .use(getChannelRoute)
  .use(listChannelsRoute)
  .use(channelThumbRoute)
  .use(getUserRoute)
  .use(userChannelsRoute)
  .use(userFollowingRoute)
  .use(userFollowersRoute)
  .use(getBlockRoute)
  .use(blockConnectionsRoute)
  .use(blockCommentsRoute)
  .use(searchRoute);

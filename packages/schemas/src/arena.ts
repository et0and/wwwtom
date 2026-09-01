import type { Block, Channel, Group, User } from "@aredotna/sdk";
import type {
  ChannelListResponse,
  CommentListResponse,
  ConnectableListResponse,
  Connection,
  EverythingListResponse,
  FollowableListResponse,
  UserListResponse,
} from "@aredotna/sdk/api";

/**
 * Small client-level types not covered by the Are.na SDK.
 */
export type ArenaBlockData = {
  readonly slug: string;
  readonly title?: string;
};

export type PaginationAttributes = {
  readonly page?: number;
  readonly per?: number;
  readonly sort?: string;
  readonly direction?: "asc" | "desc";
  readonly forceRefresh?: boolean;
};

/**
 * Response types backed by the Are.na SDK types.
 * The SDK is the source of truth for the Are.na wire contract.
 */
export type MeApiResponse = User;
export type GetUserApiResponse = User;
export type GetUserFollowersApiResponse = UserListResponse;
export type GetUserFollowingApiResponse = FollowableListResponse;
export type GetChannelContentsApiResponse = ConnectableListResponse;
export type GetBlockApiResponse = Block;
export type GetBlockChannelsApiResponse = ChannelListResponse;
export type GetBlockCommentApiResponse = CommentListResponse;
export type SearchApiResponse = EverythingListResponse;
export type GetGroupApiResponse = Group;
export type CreateChannelApiResponse = Channel;
export type GetConnectionsApiResponse = Connection;
export type ArenaBlock = Block;
export type ArenaChannelContents = ConnectableListResponse["data"][number];

/**
 * Legacy raw-fetch endpoints that the SDK does not cover.
 * These are the wire contracts the @tom/arena client parses for them.
 */
export type GetUserChannelsApiResponse = {
  readonly total_pages: number;
  readonly current_page: number;
  readonly per: number;
  readonly base_type: "User";
  readonly type: "User";
  readonly channels: Array<Channel>;
};

export type GetGroupChannelsApiResponse = {
  readonly total_pages: number | null;
  readonly current_page: number;
  readonly per: number;
  readonly channel_title: string | null;
  readonly channels: Array<Channel>;
};

export type GetChannelsApiResponse = Channel & {
  readonly per: number;
  readonly page: number;
  readonly owner: User | null;
  readonly collaborators: Array<Array<unknown>> | null;
};

export type GetChannelThumbApiResponse = Channel & {
  readonly contents: Array<unknown> | null;
};

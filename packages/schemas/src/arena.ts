import { Effect, Schema } from "effect";
import type { Block, Channel, Group, User } from "@aredotna/sdk";
import type {
  BlockImage,
  ChannelListResponse,
  CommentListResponse,
  ConnectableListResponse,
  EverythingListResponse,
  FollowableListResponse,
  UserListResponse,
} from "@aredotna/sdk/api";

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
export type ArenaBlock = Block;
export type ArenaBlockImage = BlockImage;
export type ArenaChannelContents = ConnectableListResponse["data"][number];

/**
 * Legacy raw-fetch endpoints that the SDK does not cover.
 * These are the wire contracts the @tom/arena client parses for them.
 * Channel/User stay opaque: the SDK is the source of truth for their shape,
 * so the schemas only check they are objects and validate the envelope.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- declare guard over unknown wire data; SDK owns the Channel shape
const isChannel = (input: unknown): input is Channel =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- opaque SDK type; object check is the boundary
  typeof input === "object" && input !== null;
// oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- declare guard over unknown wire data; SDK owns the User shape
const isUser = (input: unknown): input is User => typeof input === "object" && input !== null;

export const ChannelSchema = Schema.declare<Channel>(isChannel);
export const UserSchema = Schema.declare<User>(isUser);

export const GetUserChannelsApiResponseSchema = Schema.Struct({
  total_pages: Schema.Finite,
  current_page: Schema.Finite,
  per: Schema.Finite,
  base_type: Schema.Literal("User").pipe(
    Schema.withDecodingDefault(Effect.succeed("User" as const)),
  ),
  type: Schema.Literal("User").pipe(Schema.withDecodingDefault(Effect.succeed("User" as const))),
  channels: Schema.Array(ChannelSchema),
});
export type GetUserChannelsApiResponse = Schema.Schema.Type<
  typeof GetUserChannelsApiResponseSchema
>;

export const GetGroupChannelsApiResponseSchema = Schema.Struct({
  total_pages: Schema.NullOr(Schema.Finite).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  current_page: Schema.Finite,
  per: Schema.Finite,
  channel_title: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  channels: Schema.Array(ChannelSchema),
});
export type GetGroupChannelsApiResponse = Schema.Schema.Type<
  typeof GetGroupChannelsApiResponseSchema
>;

const GetChannelsExtrasSchema = Schema.Struct({
  per: Schema.Finite,
  page: Schema.Finite,
  owner: Schema.NullOr(UserSchema).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  collaborators: Schema.NullOr(Schema.Array(Schema.Array(Schema.Unknown))).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
});

export const GetChannelsApiResponseSchema = Schema.declare<
  Channel & {
    readonly per: number;
    readonly page: number;
    readonly owner: User | null;
    readonly collaborators: Array<Array<unknown>> | null;
  }
>(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- declare guard over unknown wire data; extras Struct owns the envelope check
  (
    input,
  ): input is Channel & {
    readonly per: number;
    readonly page: number;
    readonly owner: User | null;
    readonly collaborators: Array<Array<unknown>> | null;
  } => isChannel(input) && Schema.is(GetChannelsExtrasSchema)(input),
);
export type GetChannelsApiResponse = Schema.Schema.Type<typeof GetChannelsApiResponseSchema>;

const GetChannelThumbExtrasSchema = Schema.Struct({
  contents: Schema.NullOr(Schema.Array(Schema.Unknown)).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
});

export const GetChannelThumbApiResponseSchema = Schema.declare<
  Channel & { readonly contents: Array<unknown> | null }
>(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- declare guard over unknown wire data; extras Struct owns the envelope check
  (input): input is Channel & { readonly contents: Array<unknown> | null } =>
    isChannel(input) && Schema.is(GetChannelThumbExtrasSchema)(input),
);
export type GetChannelThumbApiResponse = Schema.Schema.Type<
  typeof GetChannelThumbApiResponseSchema
>;

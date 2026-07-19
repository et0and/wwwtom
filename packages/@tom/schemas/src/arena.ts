import { Schema, Struct, Tuple } from "effect";
import {
  ArenaBlockId,
  ArenaChannelId,
  ArenaCommentId,
  ArenaConnectionId,
  ArenaGroupId,
  ArenaUserId,
} from "./branded";

const ArenaImageVersionSchema = Schema.Struct({
  src: Schema.String,
  src_2x: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
});

const ArenaImageSchema = Schema.Struct({
  src: Schema.String,
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  aspect_ratio: Schema.optional(Schema.Number),
  content_type: Schema.optional(Schema.String),
  filename: Schema.optional(Schema.String),
  file_size: Schema.optional(Schema.Number),
  alt_text: Schema.optional(Schema.String),
  blurhash: Schema.optional(Schema.String),
  small: ArenaImageVersionSchema,
  medium: ArenaImageVersionSchema,
  large: ArenaImageVersionSchema,
  square: ArenaImageVersionSchema,
});

const ArenaAttachmentSchema = Schema.Struct({
  content_type: Schema.String,
  extension: Schema.String,
  file_name: Schema.String,
  file_size: Schema.Number,
  file_size_display: Schema.String,
  url: Schema.String,
});

const ArenaEmbedSchema = Schema.Struct({
  author_name: Schema.NullOr(Schema.String),
  author_url: Schema.NullOr(Schema.String),
  height: Schema.Number,
  html: Schema.NullOr(Schema.String),
  source_url: Schema.NullOr(Schema.String),
  thumbnail_url: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  type: Schema.NullOr(Schema.Literal("rich")),
  url: Schema.NullOr(Schema.String),
  width: Schema.Number,
});

const ArenaMarkdownContentSchema = Schema.Struct({
  markdown: Schema.String,
  html: Schema.String,
  plain: Schema.String,
});

const ArenaEmbeddedUserSchema = Schema.Struct({
  id: ArenaUserId,
  type: Schema.Literal("User"),
  slug: Schema.String,
  full_name: Schema.optional(Schema.String),
});

const ArenaConnectionSchema = Schema.Struct({
  id: ArenaConnectionId,
  position: Schema.Number,
  pinned: Schema.Boolean,
  connected_at: Schema.String,
  connected_by: Schema.optional(ArenaEmbeddedUserSchema),
});

const ArenaUserSchema = Schema.Struct({
  id: ArenaUserId,
  slug: Schema.String,
  username: Schema.String,
  first_name: Schema.String,
  last_name: Schema.String,
  avatar: Schema.String,
  avatar_image: Schema.NullOr(Schema.Array(ArenaImageSchema)),
  channel_count: Schema.Number,
  following_count: Schema.Number,
  profile_id: ArenaUserId,
  follower_count: Schema.Number,
  type: Schema.Literal("User"),
  initials: Schema.String,
});

const ArenaUserWithDetailsSchema = ArenaUserSchema.pipe((schema) =>
  schema.mapFields((fields) =>
    Struct.assign({
      avatar_image: Schema.NullOr(
        Schema.Struct({
          display: Schema.String,
          thumb: Schema.String,
        }),
      ),
      can_index: Schema.Boolean,
      badge: Schema.NullOr(Schema.String),
      created_at: Schema.String,
      is_confirmed: Schema.Boolean,
      is_exceeding_private_connections_limit: Schema.optional(Schema.Boolean),
      is_lifetime_premium: Schema.Boolean,
      is_pending_confirmation: Schema.Boolean,
      is_pending_reconfirmation: Schema.Boolean,
      is_premium: Schema.Boolean,
      is_supporter: Schema.Boolean,
      metadata: Schema.Struct({ description: Schema.NullOr(Schema.String) }),
    })(Struct.omit(fields, ["avatar_image"])),
  ),
);

const ArenaGroupSchema = Schema.Struct({
  id: ArenaGroupId,
  type: Schema.Literal("Group"),
  base_type: Schema.Literal("Group"),
  created_at: Schema.String,
  updated_at: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  visibility: Schema.optional(Schema.Number),
  slug: Schema.String,
});

const ArenaOwnerInfoSchema = Schema.Struct({
  owner_type: Schema.Union([Schema.Literal("Group"), Schema.Literal("User")]),
  owner_id: Schema.String,
  owner_slug: Schema.optional(Schema.String),
});

const ArenaChannelCountsSchema = Schema.Struct({
  contents: Schema.Number,
  blocks: Schema.Number,
  channels: Schema.Number,
  collaborators: Schema.Number,
});

const ArenaChannelSchema = Schema.Struct({
  id: ArenaChannelId,
  title: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
  added_to_at: Schema.optional(Schema.String),
  collaboration: Schema.Boolean,
  slug: Schema.String,
  counts: ArenaChannelCountsSchema,
  kind: Schema.Union([Schema.Literal("default"), Schema.Literal("profile")]),
  visibility: Schema.Union([
    Schema.Literal("private"),
    Schema.Literal("public"),
    Schema.Literal("closed"),
  ]),
  state: Schema.Literal("available"),
  "nsfw?": Schema.Boolean,
  metadata: Schema.NullOr(Schema.Struct({ description: Schema.NullOr(Schema.String) })),
  user_id: ArenaUserId,
  type: Schema.Literal("Channel"),
  base_type: Schema.Literal("Channel"),
});

const ArenaBaseBlockSchema = Schema.Struct({
  id: ArenaBlockId,
  title: Schema.NullOr(Schema.String),
  updated_at: Schema.String,
  created_at: Schema.String,
  state: Schema.Union([
    Schema.Literal("available"),
    Schema.Literal("failure"),
    Schema.Literal("processed"),
    Schema.Literal("processing"),
    Schema.Literal("remote_processing"),
  ]),
  visibility: Schema.optional(Schema.Union([Schema.Literal("private"), Schema.Literal("public")])),
  comment_count: Schema.Number,
  generated_title: Schema.String,
  type: Schema.Union([
    Schema.Literal("Image"),
    Schema.Literal("Text"),
    Schema.Literal("Link"),
    Schema.Literal("Embed"),
    Schema.Literal("Attachment"),
  ]),
  base_type: Schema.Literal("Block"),
  connection: Schema.optional(ArenaConnectionSchema),
  content: Schema.optional(ArenaMarkdownContentSchema),
  description: Schema.optional(ArenaMarkdownContentSchema),
  source: Schema.NullOr(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      url: Schema.String,
      provider: Schema.NullOr(
        Schema.Struct({
          url: Schema.String,
          name: Schema.String,
        }),
      ),
    }),
  ),
  image: Schema.NullOr(ArenaImageSchema),
  user: ArenaUserWithDetailsSchema,
  group: Schema.optional(Schema.NullOr(ArenaGroupSchema)),
  attachment: Schema.optional(Schema.NullOr(ArenaAttachmentSchema)),
  embed: Schema.optional(Schema.NullOr(ArenaEmbedSchema)),
  connections: Schema.optional(Schema.Array(Schema.suspend(() => ArenaChannelSchema))),
});

const ArenaImageBlockSchema = ArenaBaseBlockSchema.pipe((schema) =>
  schema.mapFields((fields) =>
    Struct.assign({
      type: Schema.Literal("Image"),
      image: ArenaImageSchema,
      source: Schema.Struct({
        title: Schema.optional(Schema.String),
        url: Schema.String,
        provider: Schema.NullOr(
          Schema.Struct({
            url: Schema.String,
            name: Schema.String,
          }),
        ),
      }),
    })(Struct.omit(fields, ["type", "image", "source"])),
  ),
);

const ArenaTextBlockSchema = ArenaBaseBlockSchema.pipe((schema) =>
  schema.mapFields((fields) =>
    Struct.assign({
      type: Schema.Literal("Text"),
      content: ArenaMarkdownContentSchema,
    })(Struct.omit(fields, ["type", "content"])),
  ),
);

const ArenaLinkBlockSchema = ArenaBaseBlockSchema.pipe((schema) =>
  schema.mapFields((fields) =>
    Struct.assign({
      type: Schema.Literal("Link"),
      image: ArenaImageSchema,
      source: Schema.Struct({
        title: Schema.optional(Schema.String),
        url: Schema.String,
        provider: Schema.NullOr(
          Schema.Struct({
            url: Schema.String,
            name: Schema.String,
          }),
        ),
      }),
    })(Struct.omit(fields, ["type", "image", "source"])),
  ),
);

const ArenaEmbedBlockSchema = ArenaBaseBlockSchema.pipe((schema) =>
  schema.mapFields((fields) =>
    Struct.assign({
      type: Schema.Literal("Embed"),
    })(Struct.omit(fields, ["type"])),
  ),
);

const ArenaAttachmentBlockSchema = ArenaBaseBlockSchema.pipe((schema) =>
  schema.mapFields((fields) =>
    Struct.assign({
      type: Schema.Literal("Attachment"),
    })(Struct.omit(fields, ["type"])),
  ),
);

const ArenaBlockSchema = Schema.Union([
  ArenaImageBlockSchema,
  ArenaTextBlockSchema,
  ArenaLinkBlockSchema,
  ArenaEmbedBlockSchema,
  ArenaAttachmentBlockSchema,
]);

const ArenaCommentEntitySchema = Schema.Struct({
  type: Schema.Literal("user"),
  user_id: ArenaUserId,
  user_slug: Schema.String,
  user_name: Schema.String,
  start: Schema.Number,
  end: Schema.Number,
});

const ArenaBlockCommentSchema = Schema.Struct({
  id: ArenaCommentId,
  created_at: Schema.String,
  updated_at: Schema.String,
  commentable_id: ArenaBlockId,
  commentable_type: Schema.Literal("Block"),
  body: Schema.String,
  user_id: Schema.String,
  deleted: Schema.NullOr(Schema.Boolean),
  entities: Schema.Array(ArenaCommentEntitySchema),
  base_type: Schema.Literal("Comment"),
  user: ArenaUserWithDetailsSchema,
});

const ConnectionDataSchema = Schema.Struct({
  position: Schema.Number,
  pinned: Schema.Boolean,
  connected_at: Schema.String,
  connected_by_user_id: ArenaUserId,
  connection_id: Schema.optional(ArenaConnectionId),
  connected_by_username: Schema.optional(Schema.String),
  connected_by_user_slug: Schema.optional(Schema.String),
});

// Encoded types (input from API) - IDs are plain numbers
type ArenaChannelContentsEncoded =
  | (Schema.Codec.Encoded<typeof ArenaBlockSchema> &
      Schema.Codec.Encoded<typeof ConnectionDataSchema>)
  | (Schema.Codec.Encoded<typeof ArenaOwnerInfoSchema> &
      Schema.Codec.Encoded<typeof ArenaChannelSchema> & {
        readonly user?: Schema.Codec.Encoded<typeof ArenaUserWithDetailsSchema> | undefined;
        readonly group?: Schema.Codec.Encoded<typeof ArenaGroupSchema> | undefined;
        readonly follower_count: number;
        readonly can_index: boolean;
        readonly contents: ReadonlyArray<ArenaChannelContentsEncoded> | null;
      } & Schema.Codec.Encoded<typeof ConnectionDataSchema>);

// Decoded types (after transformation) - IDs are branded
type ArenaChannelContentsDecoded =
  | (Schema.Schema.Type<typeof ArenaBlockSchema> & Schema.Schema.Type<typeof ConnectionDataSchema>)
  | (Schema.Schema.Type<typeof ArenaOwnerInfoSchema> &
      Schema.Schema.Type<typeof ArenaChannelSchema> & {
        readonly user?: Schema.Schema.Type<typeof ArenaUserWithDetailsSchema> | undefined;
        readonly group?: Schema.Schema.Type<typeof ArenaGroupSchema> | undefined;
        readonly follower_count: number;
        readonly can_index: boolean;
        readonly contents: ReadonlyArray<ArenaChannelContentsDecoded> | null;
      } & Schema.Schema.Type<typeof ConnectionDataSchema>);

// Recursive schemas with explicit types for circular dependency resolution
const ArenaChannelContentsSchema: Schema.Codec<
  ArenaChannelContentsDecoded,
  ArenaChannelContentsEncoded
> = Schema.suspend(
  () =>
    Schema.Union([
      ...ArenaBlockSchema.mapMembers(Tuple.map(Schema.fieldsAssign(ConnectionDataSchema.fields)))
        .members,
      ArenaChannelWithDetailsSchema.pipe(Schema.fieldsAssign(ConnectionDataSchema.fields)),
    ]) as unknown as Schema.Codec<ArenaChannelContentsDecoded, ArenaChannelContentsEncoded>,
);

const ArenaChannelWithDetailsSchema = ArenaOwnerInfoSchema.pipe(
  Schema.fieldsAssign(ArenaChannelSchema.fields),
  Schema.fieldsAssign({
    user: Schema.optional(ArenaUserWithDetailsSchema),
    group: Schema.optional(ArenaGroupSchema),
    follower_count: Schema.Number,
    can_index: Schema.Boolean,
    contents: Schema.NullOr(Schema.Array(ArenaChannelContentsSchema)),
  }),
);

const MeApiResponseSchema = ArenaUserWithDetailsSchema.pipe(
  Schema.fieldsAssign({
    channels: Schema.Array(Schema.suspend(() => GetChannelsApiResponseSchema)),
  }),
);

const GetUserApiResponseSchema = ArenaUserWithDetailsSchema;

const GetUserFollowersApiResponseSchema = Schema.Struct({
  total_pages: Schema.Number,
  current_page: Schema.Number,
  per: Schema.Number,
  base_type: Schema.Literal("User"),
  type: Schema.Literal("User"),
  users: Schema.Array(ArenaUserWithDetailsSchema),
});

const GetUserFollowingApiResponseSchema = GetUserFollowersApiResponseSchema;

const GetUserChannelsApiResponseSchema = Schema.Struct({
  total_pages: Schema.Number,
  current_page: Schema.Number,
  per: Schema.Number,
  base_type: Schema.Literal("User"),
  type: Schema.Literal("User"),
  channels: Schema.Array(ArenaChannelWithDetailsSchema),
});

const GetBlockCommentApiResponseSchema = Schema.Struct({
  total_pages: Schema.NullOr(Schema.Number),
  current_page: Schema.Number,
  per: Schema.Number,
  channel_title: Schema.NullOr(Schema.String),
  comments: Schema.Array(ArenaBlockCommentSchema),
});

const CreateBlockCommentApiResponseSchema = ArenaBlockCommentSchema;

const GetBlockApiResponseSchema = ArenaBlockSchema.pipe((schema) =>
  schema.mapMembers(
    Tuple.map(Schema.fieldsAssign({ connections: Schema.Array(ArenaChannelSchema) })),
  ),
);

const CreateBlockApiResponseSchema = ArenaBlockSchema.mapMembers(
  Tuple.map(Schema.fieldsAssign(ConnectionDataSchema.fields)),
);

const GetBlockChannelsApiResponseSchema = Schema.Struct({
  total_pages: Schema.Number,
  current_page: Schema.Number,
  per: Schema.Number,
  channels: Schema.Array(ArenaChannelWithDetailsSchema),
});

const GetGroupApiResponseSchema = ArenaGroupSchema.pipe(
  Schema.fieldsAssign({
    title: Schema.String,
    user: ArenaUserWithDetailsSchema,
    users: Schema.Array(ArenaUserWithDetailsSchema),
    member_ids: Schema.Array(ArenaUserId),
    accessible_by_ids: Schema.Array(ArenaUserId),
    published: Schema.Boolean,
  }),
);

const CreateChannelApiResponseSchema = ArenaChannelSchema.pipe(
  Schema.fieldsAssign(ArenaOwnerInfoSchema.fields),
);

const GetChannelThumbApiResponseSchema = ArenaChannelSchema.pipe(
  Schema.fieldsAssign(ArenaOwnerInfoSchema.fields),
  Schema.fieldsAssign({
    contents: Schema.NullOr(
      Schema.Array(
        Schema.Union([
          ...ArenaBlockSchema.mapMembers(
            Tuple.map(Schema.fieldsAssign(ConnectionDataSchema.fields)),
          ).members,
          ArenaChannelWithDetailsSchema.mapFields((fields) =>
            Struct.assign(ConnectionDataSchema.fields)(Struct.omit(fields, ["contents"])),
          ),
        ]),
      ),
    ),
  }),
);

const ArenaPaginationMetaSchema = Schema.Struct({
  current_page: Schema.Number,
  per_page: Schema.Number,
  total_pages: Schema.Number,
  total_count: Schema.Number,
  next_page: Schema.optional(Schema.Union([Schema.Number, Schema.Null])),
  prev_page: Schema.optional(Schema.Union([Schema.Number, Schema.Null])),
  has_more_pages: Schema.optional(Schema.Boolean),
});

const GetChannelContentsApiResponseSchema = Schema.Struct({
  data: Schema.Array(ArenaChannelContentsSchema),
  meta: ArenaPaginationMetaSchema,
});

const ChannelConnectBlockApiResponseSchema = ArenaBlockSchema.pipe((schema) =>
  schema.mapMembers(Tuple.map(Schema.fieldsAssign(ConnectionDataSchema.fields))),
);

const ChannelConnectChannelApiResponseSchema = ArenaChannelWithDetailsSchema.pipe(
  Schema.fieldsAssign(ConnectionDataSchema.fields),
);

const GetGroupChannelsApiResponseSchema = Schema.Struct({
  total_pages: Schema.NullOr(Schema.Number),
  current_page: Schema.Number,
  per: Schema.Number,
  channel_title: Schema.NullOr(Schema.String),
  channels: Schema.Array(ArenaChannelWithDetailsSchema),
});

const GetChannelsApiResponseSchema = ArenaChannelWithDetailsSchema.pipe(
  Schema.fieldsAssign({
    per: Schema.Number,
    page: Schema.Number,
    owner: Schema.NullOr(ArenaUserWithDetailsSchema),
    collaborators: Schema.NullOr(Schema.Array(Schema.Array(ArenaUserSchema))),
  }),
);

const GetConnectionsApiResponseSchema = Schema.Union([
  ...ArenaBlockSchema.mapMembers(Tuple.map(Schema.fieldsAssign(ConnectionDataSchema.fields)))
    .members,
  GetChannelsApiResponseSchema.pipe(Schema.fieldsAssign(ConnectionDataSchema.fields)),
]);

const PaginationAttributesSchema = Schema.Struct({
  per: Schema.optional(Schema.Number),
  page: Schema.optional(Schema.Number),
  sort: Schema.optional(Schema.String),
  direction: Schema.optional(Schema.Union([Schema.Literal("asc"), Schema.Literal("desc")])),
  forceRefresh: Schema.optional(Schema.Boolean),
});

const SearchApiResponseSchema = Schema.Struct({
  term: Schema.String,
  per: Schema.Number,
  current_page: Schema.Number,
  total_pages: Schema.Number,
  authenticated: Schema.Boolean,
  channels: Schema.Array(ArenaChannelSchema),
  blocks: Schema.Array(ArenaBlockSchema),
  users: Schema.Array(ArenaUserWithDetailsSchema),
});

const ArenaBlockDataSchema = Schema.Struct({
  slug: Schema.String,
  title: Schema.optional(Schema.String),
});

export {
  ArenaBlockDataSchema,
  ArenaImageVersionSchema,
  ArenaImageSchema,
  ArenaAttachmentSchema,
  ArenaEmbedSchema,
  ArenaMarkdownContentSchema,
  ArenaEmbeddedUserSchema,
  ArenaConnectionSchema,
  ArenaUserSchema,
  ArenaUserWithDetailsSchema,
  ArenaGroupSchema,
  ArenaOwnerInfoSchema,
  ArenaChannelCountsSchema,
  ArenaChannelSchema,
  ArenaBaseBlockSchema,
  ArenaImageBlockSchema,
  ArenaTextBlockSchema,
  ArenaLinkBlockSchema,
  ArenaEmbedBlockSchema,
  ArenaAttachmentBlockSchema,
  ArenaBlockSchema,
  ArenaCommentEntitySchema,
  ArenaBlockCommentSchema,
  ConnectionDataSchema,
  ArenaChannelWithDetailsSchema,
  ArenaChannelContentsSchema,
  MeApiResponseSchema,
  GetUserApiResponseSchema,
  GetUserFollowersApiResponseSchema,
  GetUserFollowingApiResponseSchema,
  GetUserChannelsApiResponseSchema,
  GetBlockCommentApiResponseSchema,
  CreateBlockCommentApiResponseSchema,
  GetBlockApiResponseSchema,
  CreateBlockApiResponseSchema,
  GetBlockChannelsApiResponseSchema,
  GetGroupApiResponseSchema,
  CreateChannelApiResponseSchema,
  GetChannelThumbApiResponseSchema,
  GetChannelContentsApiResponseSchema,
  ArenaPaginationMetaSchema,
  ChannelConnectBlockApiResponseSchema,
  ChannelConnectChannelApiResponseSchema,
  GetGroupChannelsApiResponseSchema,
  GetChannelsApiResponseSchema,
  GetConnectionsApiResponseSchema,
  PaginationAttributesSchema,
  SearchApiResponseSchema,
};

export type ArenaBlockData = Schema.Schema.Type<typeof ArenaBlockDataSchema>;
export type ArenaImageVersion = Schema.Schema.Type<typeof ArenaImageVersionSchema>;
export type ArenaImage = Schema.Schema.Type<typeof ArenaImageSchema>;
export type ArenaAttachment = Schema.Schema.Type<typeof ArenaAttachmentSchema>;
export type ArenaEmbed = Schema.Schema.Type<typeof ArenaEmbedSchema>;
export type ArenaMarkdownContent = Schema.Schema.Type<typeof ArenaMarkdownContentSchema>;
export type ArenaEmbeddedUser = Schema.Schema.Type<typeof ArenaEmbeddedUserSchema>;
export type ArenaConnection = Schema.Schema.Type<typeof ArenaConnectionSchema>;
export type ArenaUser = Schema.Schema.Type<typeof ArenaUserSchema>;
export type ArenaUserWithDetails = Schema.Schema.Type<typeof ArenaUserWithDetailsSchema>;
export type ArenaGroup = Schema.Schema.Type<typeof ArenaGroupSchema>;
export type ArenaOwnerInfo = Schema.Schema.Type<typeof ArenaOwnerInfoSchema>;
export type ArenaChannelCounts = Schema.Schema.Type<typeof ArenaChannelCountsSchema>;
export type ArenaChannel = Schema.Schema.Type<typeof ArenaChannelSchema>;
export type ArenaBaseBlock = Schema.Schema.Type<typeof ArenaBaseBlockSchema>;
export type ArenaImageBlock = Schema.Schema.Type<typeof ArenaImageBlockSchema>;
export type ArenaTextBlock = Schema.Schema.Type<typeof ArenaTextBlockSchema>;
export type ArenaLinkBlock = Schema.Schema.Type<typeof ArenaLinkBlockSchema>;
export type ArenaEmbedBlock = Schema.Schema.Type<typeof ArenaEmbedBlockSchema>;
export type ArenaAttachmentBlock = Schema.Schema.Type<typeof ArenaAttachmentBlockSchema>;
export type ArenaBlock = Schema.Schema.Type<typeof ArenaBlockSchema>;
export type ArenaCommentEntity = Schema.Schema.Type<typeof ArenaCommentEntitySchema>;
export type ArenaBlockComment = Schema.Schema.Type<typeof ArenaBlockCommentSchema>;
export type ConnectionData = Schema.Schema.Type<typeof ConnectionDataSchema>;
export type ArenaChannelContents = Schema.Schema.Type<typeof ArenaChannelContentsSchema>;
export type ArenaChannelWithDetails = Schema.Schema.Type<typeof ArenaChannelWithDetailsSchema>;
export type MeApiResponse = Schema.Schema.Type<typeof MeApiResponseSchema>;
export type GetUserApiResponse = Schema.Schema.Type<typeof GetUserApiResponseSchema>;
export type GetUserFollowersApiResponse = Schema.Schema.Type<
  typeof GetUserFollowersApiResponseSchema
>;
export type GetUserFollowingApiResponse = Schema.Schema.Type<
  typeof GetUserFollowingApiResponseSchema
>;
export type GetUserChannelsApiResponse = Schema.Schema.Type<
  typeof GetUserChannelsApiResponseSchema
>;
export type GetBlockCommentApiResponse = Schema.Schema.Type<
  typeof GetBlockCommentApiResponseSchema
>;
export type CreateBlockCommentApiResponse = Schema.Schema.Type<
  typeof CreateBlockCommentApiResponseSchema
>;
export type GetBlockApiResponse = Schema.Schema.Type<typeof GetBlockApiResponseSchema>;
export type CreateBlockApiResponse = Schema.Schema.Type<typeof CreateBlockApiResponseSchema>;
export type GetBlockChannelsApiResponse = Schema.Schema.Type<
  typeof GetBlockChannelsApiResponseSchema
>;
export type GetGroupApiResponse = Schema.Schema.Type<typeof GetGroupApiResponseSchema>;
export type CreateChannelApiResponse = Schema.Schema.Type<typeof CreateChannelApiResponseSchema>;
export type GetChannelThumbApiResponse = Schema.Schema.Type<
  typeof GetChannelThumbApiResponseSchema
>;
export type GetChannelContentsApiResponse = Schema.Schema.Type<
  typeof GetChannelContentsApiResponseSchema
>;
export type ArenaPaginationMeta = Schema.Schema.Type<typeof ArenaPaginationMetaSchema>;
export type ChannelConnectBlockApiResponse = Schema.Schema.Type<
  typeof ChannelConnectBlockApiResponseSchema
>;
export type ChannelConnectChannelApiResponse = Schema.Schema.Type<
  typeof ChannelConnectChannelApiResponseSchema
>;
export type GetGroupChannelsApiResponse = Schema.Schema.Type<
  typeof GetGroupChannelsApiResponseSchema
>;
export type GetChannelsApiResponse = Schema.Schema.Type<typeof GetChannelsApiResponseSchema>;
export type GetConnectionsApiResponse = Schema.Schema.Type<typeof GetConnectionsApiResponseSchema>;
export type PaginationAttributes = Schema.Schema.Type<typeof PaginationAttributesSchema>;
export type SearchApiResponse = Schema.Schema.Type<typeof SearchApiResponseSchema>;

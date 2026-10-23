import { Schema } from "effect";
import { ListResponseSchema } from "./list";

/**
 * Content served from are.na master channels. A post or work is a channel
 * connected to a master channel; its blocks, in position order, are the body.
 * These schemas mirror the are.na v3 wire names so decoding needs no renames,
 * and carry only the fields the site reads.
 */

export const ArenaChannelId = Schema.Finite.pipe(Schema.brand("ArenaChannelId"));
export type ArenaChannelId = typeof ArenaChannelId.Type;

export const ArenaBlockId = Schema.Finite.pipe(Schema.brand("ArenaBlockId"));
export type ArenaBlockId = typeof ArenaBlockId.Type;

/** are.na channel slug; also the public URL slug for a post or work. */
export const ArenaSlug = Schema.NonEmptyString.pipe(Schema.brand("ArenaSlug"));
export type ArenaSlug = typeof ArenaSlug.Type;

/** Markdown as are.na renders it: source, HTML, and plain text. */
export const ArenaMarkdownSchema = Schema.Struct({
  markdown: Schema.String,
  html: Schema.String,
  plain: Schema.String,
});
export type ArenaMarkdown = typeof ArenaMarkdownSchema.Type;

export const ArenaImageVersionSchema = Schema.Struct({
  src: Schema.String,
  src_2x: Schema.optional(Schema.String),
  width: Schema.optional(Schema.NullOr(Schema.Finite)),
  height: Schema.optional(Schema.NullOr(Schema.Finite)),
});
export type ArenaImageVersion = typeof ArenaImageVersionSchema.Type;

export const ArenaImageSchema = Schema.Struct({
  src: Schema.optional(Schema.String),
  alt_text: Schema.optional(Schema.NullOr(Schema.String)),
  medium: Schema.optional(ArenaImageVersionSchema),
  large: Schema.optional(ArenaImageVersionSchema),
});
export type ArenaImage = typeof ArenaImageSchema.Type;

export const ArenaSourceSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.optional(Schema.NullOr(Schema.String)),
});
export type ArenaSource = typeof ArenaSourceSchema.Type;

export const ArenaAttachmentSchema = Schema.Struct({
  url: Schema.String,
  filename: Schema.optional(Schema.NullOr(Schema.String)),
  content_type: Schema.optional(Schema.NullOr(Schema.String)),
});
export type ArenaAttachment = typeof ArenaAttachmentSchema.Type;

export const ArenaEmbedSchema = Schema.Struct({
  url: Schema.optional(Schema.NullOr(Schema.String)),
  source_url: Schema.optional(Schema.NullOr(Schema.String)),
  width: Schema.optional(Schema.NullOr(Schema.Finite)),
  height: Schema.optional(Schema.NullOr(Schema.Finite)),
  html: Schema.optional(Schema.NullOr(Schema.String)),
});
export type ArenaEmbed = typeof ArenaEmbedSchema.Type;

const arenaBlockBase = {
  id: ArenaBlockId,
  title: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(ArenaMarkdownSchema)),
};

export const ArenaConnectionSchema = Schema.Struct({
  connected_at: Schema.String,
});
export type ArenaConnection = typeof ArenaConnectionSchema.Type;

/**
 * Channel metadata we set ourselves. `published_at` preserves the original
 * publish date when a post is migrated into are.na, because the connection
 * timestamp only records when the channel was connected.
 */
export const ArenaChannelMetadataSchema = Schema.Struct({
  published_at: Schema.optional(Schema.String),
});
export type ArenaChannelMetadata = typeof ArenaChannelMetadataSchema.Type;

/**
 * A channel resource as are.na v3 returns it, reduced to the fields this
 * project reads. `connection` is present only inside another channel's
 * contents, where it carries the connection time.
 */
export const ArenaChannelResourceSchema = Schema.Struct({
  id: ArenaChannelId,
  type: Schema.Literal("Channel"),
  slug: ArenaSlug,
  title: Schema.String,
  description: Schema.optional(Schema.NullOr(ArenaMarkdownSchema)),
  created_at: Schema.String,
  updated_at: Schema.String,
  metadata: Schema.optional(Schema.NullOr(ArenaChannelMetadataSchema)),
  connection: Schema.optional(Schema.NullOr(ArenaConnectionSchema)),
});
export type ArenaChannelResource = typeof ArenaChannelResourceSchema.Type;

export const ArenaPaginationSchema = Schema.Struct({
  current_page: Schema.Finite,
  per_page: Schema.Finite,
  total_pages: Schema.Finite,
  total_count: Schema.Finite,
  has_more_pages: Schema.Boolean,
});
export type ArenaPagination = typeof ArenaPaginationSchema.Type;

/**
 * The `{ meta, data }` envelope are.na returns for contents. Items stay
 * `unknown` so one malformed block cannot fail a whole page; callers decode
 * each item with `ArenaContentBlockSchema` or `ArenaChannelResourceSchema`.
 */
export const ArenaContentsResponseSchema = Schema.Struct({
  meta: ArenaPaginationSchema,
  data: Schema.Array(Schema.Unknown),
});
export type ArenaContentsResponse = typeof ArenaContentsResponseSchema.Type;

/** One block in a post or work body, discriminated by `type`. */
export const ArenaContentBlockSchema = Schema.Union([
  Schema.Struct({
    ...arenaBlockBase,
    type: Schema.Literal("Text"),
    content: ArenaMarkdownSchema,
  }),
  Schema.Struct({
    ...arenaBlockBase,
    type: Schema.Literal("Image"),
    image: ArenaImageSchema,
  }),
  Schema.Struct({
    ...arenaBlockBase,
    type: Schema.Literal("Link"),
    source: Schema.optional(Schema.NullOr(ArenaSourceSchema)),
    image: Schema.optional(Schema.NullOr(ArenaImageSchema)),
    content: Schema.optional(Schema.NullOr(ArenaMarkdownSchema)),
  }),
  Schema.Struct({
    ...arenaBlockBase,
    type: Schema.Literal("Attachment"),
    attachment: ArenaAttachmentSchema,
    image: Schema.optional(Schema.NullOr(ArenaImageSchema)),
  }),
  Schema.Struct({
    ...arenaBlockBase,
    type: Schema.Literal("Embed"),
    embed: ArenaEmbedSchema,
    image: Schema.optional(Schema.NullOr(ArenaImageSchema)),
  }),
  Schema.Struct({
    id: ArenaBlockId,
    type: Schema.Literal("PendingBlock"),
  }),
  Schema.Struct({
    id: ArenaChannelId,
    type: Schema.Literal("Channel"),
    slug: ArenaSlug,
    title: Schema.String,
  }),
]);
export type ArenaContentBlock = typeof ArenaContentBlockSchema.Type;

/** List item: the child channel without its blocks. */
export const ArenaEntrySummarySchema = Schema.Struct({
  id: ArenaChannelId,
  /** Public URL slug, derived from the channel title. */
  slug: ArenaSlug,
  /** The channel's own are.na slug, used to link back to are.na. */
  arenaSlug: ArenaSlug,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  publishedAt: Schema.String,
  updatedAt: Schema.String,
});
export type ArenaEntrySummary = typeof ArenaEntrySummarySchema.Type;

/** Detail: the child channel plus its blocks in display order. */
export const ArenaEntrySchema = Schema.Struct({
  ...ArenaEntrySummarySchema.fields,
  blocks: Schema.Array(ArenaContentBlockSchema),
});
export type ArenaEntry = typeof ArenaEntrySchema.Type;

export const ArenaEntryListSchema = ListResponseSchema(ArenaEntrySummarySchema);
export type ArenaEntryList = typeof ArenaEntryListSchema.Type;

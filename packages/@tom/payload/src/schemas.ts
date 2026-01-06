import { Schema } from "effect";

export type PayloadMediaSize = {
  url: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  filesize: number | null;
  filename: string | null;
};

export type PayloadMediaSizes = {
  thumbnail: PayloadMediaSize | null;
  square: PayloadMediaSize | null;
  small: PayloadMediaSize | null;
  medium: PayloadMediaSize | null;
  large: PayloadMediaSize | null;
  xlarge: PayloadMediaSize | null;
  og: PayloadMediaSize | null;
};

export type PayloadMedia = {
  id: number;
  alt: string | null;
  caption: PayloadRichContent | null;
  updatedAt: string;
  createdAt: string;
  url: string;
  thumbnailURL: string;
  filename: string;
  mimeType: string;
  filesize: number;
  width: number;
  height: number;
  focalX: number;
  focalY: number;
  sizes: PayloadMediaSizes;
};

export type PayloadBlockFields = {
  id?: string;
  media?: PayloadMedia;
  blockName?: string;
  blockType?: string;
  content?: PayloadRichContent;
  style?: string;
  url?: string;
  newTab?: boolean;
  arenaSlug?: string;
  arenaTitle?: string;
};

export type PayloadContentNode = {
  type: string;
  format?: number | string;
  indent?: number | string;
  version?: number;
  children?: readonly PayloadContentNode[];
  direction?: string | null;
  textStyle?: string;
  textFormat?: number;
  fields?: PayloadBlockFields;
  tag?: string;
  mode?: string;
  text?: string;
  style?: string;
  detail?: number;
  id?: string;
};

export type PayloadRichContent = {
  root: PayloadContentNode;
};

export type PayloadPost = {
  id: number | string;
  title: string;
  summary?: string | null;
  publishedAt: string;
  slug: string;
  content?: string | PayloadRichContent;
  heroImage?: { url: string; alt?: string } | null;
  arenaSlug?: string | null;
  arenaTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  meta?: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
  };
};

export type PayloadResponse<T> = {
  docs: readonly T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

const PayloadMediaSizeSchema = Schema.Struct({
  url: Schema.NullOr(Schema.String),
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  mimeType: Schema.NullOr(Schema.String),
  filesize: Schema.NullOr(Schema.Number),
  filename: Schema.NullOr(Schema.String),
}) as Schema.Schema<unknown, PayloadMediaSize, never>;

const PayloadMediaSizesSchema = Schema.Struct({
  thumbnail: Schema.NullOr(PayloadMediaSizeSchema),
  square: Schema.NullOr(PayloadMediaSizeSchema),
  small: Schema.NullOr(PayloadMediaSizeSchema),
  medium: Schema.NullOr(PayloadMediaSizeSchema),
  large: Schema.NullOr(PayloadMediaSizeSchema),
  xlarge: Schema.NullOr(PayloadMediaSizeSchema),
  og: Schema.NullOr(PayloadMediaSizeSchema),
}) as Schema.Schema<unknown, PayloadMediaSizes, never>;

const PayloadMediaSchema = Schema.Struct({
  id: Schema.Number,
  alt: Schema.NullOr(Schema.String),
  caption: Schema.suspend(() => Schema.NullOr(PayloadRichContentSchema)),
  updatedAt: Schema.String,
  createdAt: Schema.String,
  url: Schema.String,
  thumbnailURL: Schema.String,
  filename: Schema.String,
  mimeType: Schema.String,
  filesize: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
  focalX: Schema.Number,
  focalY: Schema.Number,
  sizes: PayloadMediaSizesSchema,
}) as Schema.Schema<unknown, PayloadMedia, never>;

const PayloadBlockFieldsSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  media: Schema.optional(PayloadMediaSchema),
  blockName: Schema.optional(Schema.String),
  blockType: Schema.optional(Schema.String),
  content: Schema.optional(Schema.suspend(() => PayloadRichContentSchema)),
  style: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  newTab: Schema.optional(Schema.Boolean),
  arenaSlug: Schema.optional(Schema.String),
  arenaTitle: Schema.optional(Schema.String),
}) as Schema.Schema<unknown, PayloadBlockFields, never>;

const PayloadContentNodeSchema = Schema.suspend(() =>
  Schema.Struct({
    type: Schema.String,
    format: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
    indent: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
    version: Schema.optional(Schema.Number),
    children: Schema.optional(Schema.Array(PayloadContentNodeSchema)),
    direction: Schema.optional(Schema.NullOr(Schema.String)),
    textStyle: Schema.optional(Schema.String),
    textFormat: Schema.optional(Schema.Number),
    fields: Schema.optional(Schema.suspend(() => PayloadBlockFieldsSchema)),
    tag: Schema.optional(Schema.String),
    mode: Schema.optional(Schema.String),
    text: Schema.optional(Schema.String),
    style: Schema.optional(Schema.String),
    detail: Schema.optional(Schema.Number),
    id: Schema.optional(Schema.String),
  }),
) as Schema.Schema<unknown, PayloadContentNode, never>;

export const PayloadRichContentSchema = Schema.Struct({
  root: PayloadContentNodeSchema,
}) as Schema.Schema<unknown, PayloadRichContent, never>;

export const PayloadPostSchema = Schema.Struct({
  id: Schema.Union(Schema.Number, Schema.String),
  title: Schema.String,
  summary: Schema.optional(Schema.NullOr(Schema.String)),
  publishedAt: Schema.String,
  slug: Schema.String,
  content: Schema.optional(Schema.Union(Schema.String, PayloadRichContentSchema)),
  heroImage: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        url: Schema.String,
        alt: Schema.optional(Schema.String),
      }),
    ),
  ),
  arenaSlug: Schema.optional(Schema.NullOr(Schema.String)),
  arenaTitle: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  meta: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.NullOr(Schema.String)),
      description: Schema.optional(Schema.NullOr(Schema.String)),
      image: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
}) as Schema.Schema<unknown, PayloadPost, never>;

export const PayloadResponseSchema = <T>(itemSchema: Schema.Schema<T>) =>
  Schema.Struct({
    docs: Schema.Array(itemSchema),
    totalDocs: Schema.Number,
    limit: Schema.Number,
    page: Schema.Number,
    totalPages: Schema.Number,
    hasNextPage: Schema.Boolean,
    hasPrevPage: Schema.Boolean,
  }) as Schema.Schema<unknown, PayloadResponse<T>, never>;

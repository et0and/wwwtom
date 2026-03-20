import { Schema } from "effect";
import { PayloadMediaId, PayloadPostId, PayloadWorkId } from "./branded.js";

export const PayloadMediaSizeSchema = Schema.Struct({
  url: Schema.NullOr(Schema.String),
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  mimeType: Schema.NullOr(Schema.String),
  filesize: Schema.NullOr(Schema.Number),
  filename: Schema.NullOr(Schema.String),
});

export const PayloadMediaSizesSchema = Schema.Struct({
  thumbnail: Schema.NullOr(PayloadMediaSizeSchema),
  square: Schema.NullOr(PayloadMediaSizeSchema),
  small: Schema.NullOr(PayloadMediaSizeSchema),
  medium: Schema.NullOr(PayloadMediaSizeSchema),
  large: Schema.NullOr(PayloadMediaSizeSchema),
  xlarge: Schema.NullOr(PayloadMediaSizeSchema),
  og: Schema.NullOr(PayloadMediaSizeSchema),
});

interface PayloadRichContentType {
  readonly root: PayloadContentNodeType;
}

interface PayloadContentNodeType {
  readonly type: string;
  readonly format?: number | string | undefined;
  readonly indent?: number | string | undefined;
  readonly version?: number | undefined;
  readonly children?: ReadonlyArray<PayloadContentNodeType> | undefined;
  readonly direction?: string | null | undefined;
  readonly textStyle?: string | undefined;
  readonly textFormat?: number | undefined;
  readonly fields?: PayloadBlockFieldsType | undefined;
  readonly tag?: string | undefined;
  readonly mode?: string | undefined;
  readonly text?: string | undefined;
  readonly style?: string | undefined;
  readonly detail?: number | undefined;
  readonly id?: string | undefined;
}

interface PayloadBlockFieldsType {
  readonly id?: string | undefined;
  readonly media?: PayloadMediaType | undefined;
  readonly blockName?: string | undefined;
  readonly blockType?: string | undefined;
  readonly content?: PayloadRichContentType | undefined;
  readonly style?: string | undefined;
  readonly url?: string | undefined;
  readonly newTab?: boolean | undefined;
  readonly arenaSlug?: string | undefined;
  readonly arenaTitle?: string | undefined;
}

interface PayloadMediaType {
  readonly id: PayloadMediaId;
  readonly alt: string | null;
  readonly caption: PayloadRichContentType | null;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly url: string;
  readonly thumbnailURL: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly filesize: number;
  readonly width: number;
  readonly height: number;
  readonly focalX: number;
  readonly focalY: number;
  readonly sizes: Schema.Schema.Type<typeof PayloadMediaSizesSchema>;
}

export const PayloadMediaSchema: Schema.Schema<PayloadMediaType> = Schema.Struct({
  id: PayloadMediaId,
  alt: Schema.NullOr(Schema.String),
  caption: Schema.suspend(
    (): Schema.Schema<PayloadRichContentType | null> => Schema.NullOr(PayloadRichContentSchema),
  ),
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
}) as unknown as Schema.Schema<PayloadMediaType>;

export const PayloadBlockFieldsSchema: Schema.Schema<PayloadBlockFieldsType> = Schema.Struct({
  id: Schema.optional(Schema.String),
  media: Schema.optional(PayloadMediaSchema),
  blockName: Schema.optional(Schema.String),
  blockType: Schema.optional(Schema.String),
  content: Schema.optional(
    Schema.suspend((): Schema.Schema<PayloadRichContentType> => PayloadRichContentSchema),
  ),
  style: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  newTab: Schema.optional(Schema.Boolean),
  arenaSlug: Schema.optional(Schema.String),
  arenaTitle: Schema.optional(Schema.String),
}) as Schema.Schema<PayloadBlockFieldsType>;

export const PayloadContentNodeSchema: Schema.Schema<PayloadContentNodeType> = Schema.suspend(
  () =>
    Schema.Struct({
      type: Schema.String,
      format: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
      indent: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
      version: Schema.optional(Schema.Number),
      children: Schema.optional(Schema.Array(PayloadContentNodeSchema)),
      direction: Schema.optional(Schema.NullOr(Schema.String)),
      textStyle: Schema.optional(Schema.String),
      textFormat: Schema.optional(Schema.Number),
      fields: Schema.optional(PayloadBlockFieldsSchema),
      tag: Schema.optional(Schema.String),
      mode: Schema.optional(Schema.String),
      text: Schema.optional(Schema.String),
      style: Schema.optional(Schema.String),
      detail: Schema.optional(Schema.Number),
      id: Schema.optional(Schema.String),
    }) as Schema.Schema<PayloadContentNodeType>,
);

export const PayloadRichContentSchema: Schema.Schema<PayloadRichContentType> = Schema.Struct({
  root: PayloadContentNodeSchema,
}) as Schema.Schema<PayloadRichContentType>;

export const PayloadHeroImageSchema = Schema.Struct({
  url: Schema.String,
  alt: Schema.optional(Schema.String),
});

export const PayloadMetaSchema = Schema.Struct({
  title: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  image: Schema.optional(Schema.NullOr(Schema.String)),
});

export const PayloadPostSchema = Schema.Struct({
  id: PayloadPostId,
  title: Schema.String,
  summary: Schema.optional(Schema.NullOr(Schema.String)),
  publishedAt: Schema.String,
  slug: Schema.String,
  content: Schema.optional(Schema.Union(Schema.String, PayloadRichContentSchema)),
  heroImage: Schema.optional(Schema.NullOr(PayloadHeroImageSchema)),
  arenaSlug: Schema.optional(Schema.NullOr(Schema.String)),
  arenaTitle: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  meta: Schema.optional(PayloadMetaSchema),
});

export const PayloadWorkSchema = Schema.Struct({
  id: PayloadWorkId,
  title: Schema.String,
  summary: Schema.optional(Schema.NullOr(Schema.String)),
  publishedAt: Schema.String,
  slug: Schema.String,
  content: Schema.optional(Schema.Union(Schema.String, PayloadRichContentSchema)),
  heroImage: Schema.optional(Schema.NullOr(PayloadHeroImageSchema)),
  arenaSlug: Schema.optional(Schema.NullOr(Schema.String)),
  arenaTitle: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  meta: Schema.optional(PayloadMetaSchema),
});

export const PayloadResponseSchema = <A, I, R>(itemSchema: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    docs: Schema.Array(itemSchema),
    totalDocs: Schema.Number,
    limit: Schema.Number,
    page: Schema.Number,
    totalPages: Schema.Number,
    hasNextPage: Schema.Boolean,
    hasPrevPage: Schema.Boolean,
  });

export type PayloadMediaSize = Schema.Schema.Type<typeof PayloadMediaSizeSchema>;
export type PayloadMediaSizes = Schema.Schema.Type<typeof PayloadMediaSizesSchema>;
export type PayloadMedia = Schema.Schema.Type<typeof PayloadMediaSchema>;
export type PayloadBlockFields = Schema.Schema.Type<typeof PayloadBlockFieldsSchema>;
export type PayloadContentNode = Schema.Schema.Type<typeof PayloadContentNodeSchema>;
export type PayloadRichContent = Schema.Schema.Type<typeof PayloadRichContentSchema>;
export type PayloadHeroImage = Schema.Schema.Type<typeof PayloadHeroImageSchema>;
export type PayloadMeta = Schema.Schema.Type<typeof PayloadMetaSchema>;
export type PayloadPost = Schema.Schema.Type<typeof PayloadPostSchema>;
export type PayloadWork = Schema.Schema.Type<typeof PayloadWorkSchema>;
export type PayloadResponse<T> = {
  readonly docs: ReadonlyArray<T>;
  readonly totalDocs: number;
  readonly limit: number;
  readonly page: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
};

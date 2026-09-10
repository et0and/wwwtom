import { Schema } from "effect";

export const CmsPostId = Schema.String.pipe(Schema.brand("CmsPostId"));
export type CmsPostId = typeof CmsPostId.Type;

export const CmsWorkId = Schema.String.pipe(Schema.brand("CmsWorkId"));
export type CmsWorkId = typeof CmsWorkId.Type;

export const CmsMediaId = Schema.String.pipe(Schema.brand("CmsMediaId"));
export type CmsMediaId = typeof CmsMediaId.Type;

export const CmsCategoryId = Schema.String.pipe(Schema.brand("CmsCategoryId"));
export type CmsCategoryId = typeof CmsCategoryId.Type;

export const CmsSlug = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^[a-z0-9-]+$/), Schema.isMaxLength(100)),
  Schema.brand("CmsSlug"),
);
export type CmsSlug = typeof CmsSlug.Type;

export const CmsStatusSchema = Schema.Literals(["draft", "published"]);
export type CmsStatus = typeof CmsStatusSchema.Type;

export const CmsStatusFilterSchema = Schema.Literals(["all", "draft", "published"]);
export type CmsStatusFilter = typeof CmsStatusFilterSchema.Type;

export const CmsBannerStyleSchema = Schema.Literals(["info", "warning", "error", "success"]);
export type CmsBannerStyle = typeof CmsBannerStyleSchema.Type;

export const TiptapMarkSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("bold") }),
  Schema.Struct({ type: Schema.Literal("italic") }),
  Schema.Struct({
    type: Schema.Literal("link"),
    attrs: Schema.Struct({
      href: Schema.String,
      target: Schema.optional(Schema.String),
    }),
  }),
]);
export type TiptapMark = typeof TiptapMarkSchema.Type;

interface TiptapInlineType {
  readonly type: "text";
  readonly text: string;
  readonly marks?: ReadonlyArray<TiptapMark> | undefined;
}

interface TiptapParagraphType {
  readonly type: "paragraph";
  readonly content?: ReadonlyArray<TiptapInlineType> | undefined;
}

interface TiptapHeadingType {
  readonly type: "heading";
  readonly attrs: { readonly level: 1 | 2 | 3 | 4 };
  readonly content?: ReadonlyArray<TiptapInlineType> | undefined;
}

interface TiptapRuleType {
  readonly type: "horizontalRule";
}

interface TiptapCodeType {
  readonly type: "codeBlock";
  readonly attrs: {
    readonly language: string;
    readonly fileName?: string | undefined;
    readonly showLineNumbers?: boolean | undefined;
  };
  readonly content?: ReadonlyArray<TiptapInlineType> | undefined;
}

interface TiptapBannerType {
  readonly type: "banner";
  readonly attrs: { readonly style: CmsBannerStyle };
  readonly content: ReadonlyArray<TiptapBlockType>;
}

interface TiptapQuoteType {
  readonly type: "blockquote";
  readonly content: ReadonlyArray<TiptapBlockType>;
}

interface TiptapArenaType {
  readonly type: "arena";
  readonly attrs: { readonly slug: string; readonly title?: string | undefined };
}

interface TiptapMediaType {
  readonly type: "cmsMedia";
  readonly attrs: { readonly mediaId: CmsMediaId; readonly alt?: string | undefined };
}

type TiptapBlockType =
  | TiptapParagraphType
  | TiptapHeadingType
  | TiptapRuleType
  | TiptapCodeType
  | TiptapBannerType
  | TiptapQuoteType
  | TiptapArenaType
  | TiptapMediaType;

interface TiptapDocType {
  readonly type: "doc";
  readonly content: ReadonlyArray<TiptapBlockType>;
}

export const TiptapInlineSchema: Schema.Codec<TiptapInlineType> = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
  marks: Schema.optional(Schema.Array(TiptapMarkSchema)),
  // oxlint-disable anti-slop/no-chained-type-assertions -- required: recursive schema types do not overlap the Codec type without an unknown bridge
}) as unknown as Schema.Codec<TiptapInlineType>;
// oxlint-enable anti-slop/no-chained-type-assertions

const tiptapHeadingLevel = Schema.Union([
  Schema.Literal(1),
  Schema.Literal(2),
  Schema.Literal(3),
  Schema.Literal(4),
]);

export const TiptapBlockSchema: Schema.Codec<TiptapBlockType> = Schema.suspend(
  () =>
    Schema.Union([
      Schema.Struct({
        type: Schema.Literal("paragraph"),
        content: Schema.optional(Schema.Array(TiptapInlineSchema)),
      }),
      Schema.Struct({
        type: Schema.Literal("heading"),
        attrs: Schema.Struct({ level: tiptapHeadingLevel }),
        content: Schema.optional(Schema.Array(TiptapInlineSchema)),
      }),
      Schema.Struct({ type: Schema.Literal("horizontalRule") }),
      Schema.Struct({
        type: Schema.Literal("codeBlock"),
        attrs: Schema.Struct({
          language: Schema.String,
          fileName: Schema.optional(Schema.String),
          showLineNumbers: Schema.optional(Schema.Boolean),
        }),
        content: Schema.optional(Schema.Array(TiptapInlineSchema)),
      }),
      Schema.Struct({
        type: Schema.Literal("banner"),
        attrs: Schema.Struct({ style: CmsBannerStyleSchema }),
        content: Schema.Array(TiptapBlockSchema),
      }),
      Schema.Struct({
        type: Schema.Literal("blockquote"),
        content: Schema.Array(TiptapBlockSchema),
      }),
      Schema.Struct({
        type: Schema.Literal("arena"),
        attrs: Schema.Struct({
          slug: Schema.String,
          title: Schema.optional(Schema.String),
        }),
      }),
      Schema.Struct({
        type: Schema.Literal("cmsMedia"),
        attrs: Schema.Struct({
          mediaId: CmsMediaId,
          alt: Schema.optional(Schema.String),
        }),
      }),
      // oxlint-disable anti-slop/no-chained-type-assertions -- required: recursive schema types do not overlap the Codec type without an unknown bridge
    ]) as unknown as Schema.Codec<TiptapBlockType>,
);
// oxlint-enable anti-slop/no-chained-type-assertions

export const TiptapDocSchema: Schema.Codec<TiptapDocType> = Schema.Struct({
  type: Schema.Literal("doc"),
  content: Schema.Array(TiptapBlockSchema),
  // oxlint-disable anti-slop/no-chained-type-assertions -- required: recursive schema types do not overlap the Codec type without an unknown bridge
}) as unknown as Schema.Codec<TiptapDocType>;
// oxlint-enable anti-slop/no-chained-type-assertions

export type TiptapInline = Schema.Schema.Type<typeof TiptapInlineSchema>;
export type TiptapBlock = Schema.Schema.Type<typeof TiptapBlockSchema>;
export type TiptapDoc = Schema.Schema.Type<typeof TiptapDocSchema>;

export const CmsMetaSchema = Schema.Struct({
  title: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
});
export type CmsMeta = typeof CmsMetaSchema.Type;

export const CmsCategorySchema = Schema.Struct({
  id: CmsCategoryId,
  slug: CmsSlug,
  title: Schema.String,
});
export type CmsCategory = typeof CmsCategorySchema.Type;

export const CmsMediaVariantSchema = Schema.Struct({
  key: Schema.String,
  width: Schema.Number,
  format: Schema.String,
});
export type CmsMediaVariant = typeof CmsMediaVariantSchema.Type;

export const CmsMediaSchema = Schema.Struct({
  id: CmsMediaId,
  key: Schema.String,
  mime: Schema.String,
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  alt: Schema.NullOr(Schema.String),
  caption: Schema.NullOr(Schema.String),
  variants: Schema.Array(CmsMediaVariantSchema),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CmsMedia = typeof CmsMediaSchema.Type;

export const CmsPostSchema = Schema.Struct({
  id: CmsPostId,
  slug: CmsSlug,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  content: TiptapDocSchema,
  html: Schema.String,
  status: CmsStatusSchema,
  publishedAt: Schema.NullOr(Schema.String),
  heroMediaId: Schema.NullOr(CmsMediaId),
  categories: Schema.Array(CmsCategorySchema),
  meta: CmsMetaSchema,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CmsPost = typeof CmsPostSchema.Type;

export const CmsWorkSchema = Schema.Struct({
  id: CmsWorkId,
  slug: CmsSlug,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  content: TiptapDocSchema,
  html: Schema.String,
  status: CmsStatusSchema,
  publishedAt: Schema.NullOr(Schema.String),
  heroMediaId: Schema.NullOr(CmsMediaId),
  meta: CmsMetaSchema,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CmsWork = typeof CmsWorkSchema.Type;

export const CmsPostInputSchema = Schema.Struct({
  slug: CmsSlug,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  content: TiptapDocSchema,
  status: CmsStatusSchema,
  publishedAt: Schema.NullOr(Schema.String),
  heroMediaId: Schema.NullOr(CmsMediaId),
  categoryIds: Schema.Array(CmsCategoryId),
  meta: CmsMetaSchema,
});
export type CmsPostInput = typeof CmsPostInputSchema.Type;

export const CmsWorkInputSchema = Schema.Struct({
  slug: CmsSlug,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  content: TiptapDocSchema,
  status: CmsStatusSchema,
  publishedAt: Schema.NullOr(Schema.String),
  heroMediaId: Schema.NullOr(CmsMediaId),
  meta: CmsMetaSchema,
});
export type CmsWorkInput = typeof CmsWorkInputSchema.Type;

export const CmsCategoryInputSchema = Schema.Struct({
  slug: CmsSlug,
  title: Schema.String,
});
export type CmsCategoryInput = typeof CmsCategoryInputSchema.Type;

export const CmsRevisionEntitySchema = Schema.Literals(["post", "work"]);
export type CmsRevisionEntity = typeof CmsRevisionEntitySchema.Type;

/** One history entry: when, by whom, and the title at that time. */
export const CmsRevisionMetaSchema = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  actor: Schema.NullOr(Schema.String),
  title: Schema.String,
});
export type CmsRevisionMeta = typeof CmsRevisionMetaSchema.Type;

/** A restorable snapshot is exactly the input a create/update accepts. */
export const CmsRevisionSnapshotSchema = Schema.Union([CmsPostInputSchema, CmsWorkInputSchema]);
export type CmsRevisionSnapshot = typeof CmsRevisionSnapshotSchema.Type;

export const CmsRestoreInputSchema = Schema.Struct({ revisionId: Schema.String });
export type CmsRestoreInput = typeof CmsRestoreInputSchema.Type;

export const CmsMediaUsageRefSchema = Schema.Struct({
  slug: CmsSlug,
  title: Schema.String,
});
export type CmsMediaUsageRef = typeof CmsMediaUsageRefSchema.Type;

/** Posts and works referencing a media asset, by content or hero image. */
export const CmsMediaUsageSchema = Schema.Struct({
  posts: Schema.Array(CmsMediaUsageRefSchema),
  works: Schema.Array(CmsMediaUsageRefSchema),
});
export type CmsMediaUsage = typeof CmsMediaUsageSchema.Type;

const PagingNumber = Schema.Union([Schema.Number, Schema.NumberFromString]);

export const CmsPagingSchema = Schema.Struct({
  page: Schema.optional(PagingNumber),
  pageSize: Schema.optional(PagingNumber),
  status: Schema.optional(CmsStatusFilterSchema),
  category: Schema.optional(CmsSlug),
});
export type CmsPaging = typeof CmsPagingSchema.Type;

export const CmsListResponseSchema = <A, I, R>(itemSchema: Schema.Codec<A, I, R>) =>
  Schema.Struct({
    docs: Schema.Array(itemSchema),
    totalDocs: Schema.Number,
    limit: Schema.Number,
    page: Schema.Number,
    totalPages: Schema.Number,
    hasNextPage: Schema.Boolean,
    hasPrevPage: Schema.Boolean,
  });

export type CmsListResponse<T> = {
  readonly docs: ReadonlyArray<T>;
  readonly totalDocs: number;
  readonly limit: number;
  readonly page: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
};

import { Schema } from "effect";

export class PayloadMediaSize extends Schema.Class<PayloadMediaSize>(
	"PayloadMediaSize",
)({
	url: Schema.NullOr(Schema.String),
	width: Schema.NullOr(Schema.Number),
	height: Schema.NullOr(Schema.Number),
	mimeType: Schema.NullOr(Schema.String),
	filesize: Schema.NullOr(Schema.Number),
	filename: Schema.NullOr(Schema.String),
}) {}

export class PayloadMediaSizes extends Schema.Class<PayloadMediaSizes>(
	"PayloadMediaSizes",
)({
	thumbnail: Schema.NullOr(PayloadMediaSize),
	square: Schema.NullOr(PayloadMediaSize),
	small: Schema.NullOr(PayloadMediaSize),
	medium: Schema.NullOr(PayloadMediaSize),
	large: Schema.NullOr(PayloadMediaSize),
	xlarge: Schema.NullOr(PayloadMediaSize),
	og: Schema.NullOr(PayloadMediaSize),
}) {}

export class PayloadRichContent extends Schema.Class<PayloadRichContent>(
	"PayloadRichContent",
)({
	root: Schema.suspend(
		(): Schema.Schema<PayloadContentNode> => PayloadContentNode,
	),
}) {}

export class PayloadBlockFields extends Schema.Class<PayloadBlockFields>(
	"PayloadBlockFields",
)({
	id: Schema.optional(Schema.String),
	media: Schema.optional(
		Schema.suspend((): Schema.Schema<PayloadMedia> => PayloadMedia),
	),
	blockName: Schema.optional(Schema.String),
	blockType: Schema.optional(Schema.String),
	content: Schema.optional(PayloadRichContent),
	style: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
	newTab: Schema.optional(Schema.Boolean),
	arenaSlug: Schema.optional(Schema.String),
	arenaTitle: Schema.optional(Schema.String),
}) {}

export class PayloadContentNode extends Schema.Class<PayloadContentNode>(
	"PayloadContentNode",
)({
	type: Schema.String,
	format: Schema.optional(Schema.Number),
	indent: Schema.optional(Schema.Number),
	version: Schema.optional(Schema.Number),
	children: Schema.optional(
		Schema.Array(
			Schema.suspend(
				(): Schema.Schema<PayloadContentNode> => PayloadContentNode,
			),
		),
	),
	direction: Schema.optional(Schema.NullOr(Schema.String)),
	textStyle: Schema.optional(Schema.String),
	textFormat: Schema.optional(Schema.Number),
	fields: Schema.optional(PayloadBlockFields),
	tag: Schema.optional(Schema.String),
	mode: Schema.optional(Schema.String),
	text: Schema.optional(Schema.String),
	style: Schema.optional(Schema.String),
	detail: Schema.optional(Schema.Number),
}) {}

export class PayloadMedia extends Schema.Class<PayloadMedia>("PayloadMedia")({
	id: Schema.Number,
	alt: Schema.NullOr(Schema.String),
	caption: Schema.NullOr(PayloadRichContent),
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
	sizes: PayloadMediaSizes,
}) {}

export class PayloadPost extends Schema.Class<PayloadPost>("PayloadPost")({
	id: Schema.String,
	title: Schema.String,
	summary: Schema.optional(Schema.String),
	publishedAt: Schema.String,
	slug: Schema.String,
	content: Schema.optional(Schema.Union(Schema.String, PayloadRichContent)),
	heroImage: Schema.optional(
		Schema.Struct({
			url: Schema.String,
			alt: Schema.optional(Schema.String),
		}),
	),
	arenaSlug: Schema.optional(Schema.String),
	arenaTitle: Schema.optional(Schema.String),
	createdAt: Schema.String,
	updatedAt: Schema.String,
	meta: Schema.optional(
		Schema.Struct({
			title: Schema.optional(Schema.String),
			description: Schema.optional(Schema.String),
			image: Schema.optional(Schema.String),
		}),
	),
}) {}

export const PayloadResponseSchema = <A, I, R>(
	schema: Schema.Schema<A, I, R>,
) =>
	Schema.Struct({
		docs: schema,
		totalDocs: Schema.Number,
		limit: Schema.Number,
		page: Schema.Number,
		totalPages: Schema.Number,
		hasNextPage: Schema.Boolean,
		hasPrevPage: Schema.Boolean,
	});

export class PayloadLinkFields extends Schema.Class<PayloadLinkFields>(
	"PayloadLinkFields",
)({
	url: Schema.String,
	newTab: Schema.optional(Schema.Boolean),
}) {}

export type PayloadResponse<T> = {
	docs: T;
	totalDocs: number;
	limit: number;
	page: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
};

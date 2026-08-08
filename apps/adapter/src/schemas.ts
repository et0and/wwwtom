import { Schema } from "effect";

export const PaginationQuerySchema = Schema.Struct({
  page: Schema.optional(Schema.NumberFromString),
  per: Schema.optional(Schema.NumberFromString),
  sort: Schema.optional(Schema.String),
  direction: Schema.optional(Schema.Union([Schema.Literal("asc"), Schema.Literal("desc")])),
});

export type PaginationQuery = Schema.Schema.Type<typeof PaginationQuerySchema>;

export const paginationQuerySchema = Schema.toStandardSchemaV1(PaginationQuerySchema);

export const SearchQuerySchema = Schema.Struct({
  query: Schema.String,
  type: Schema.optional(
    Schema.Union([
      Schema.Literal("everything"),
      Schema.Literal("channels"),
      Schema.Literal("blocks"),
      Schema.Literal("users"),
    ]),
  ),
  page: Schema.optional(Schema.NumberFromString),
  per: Schema.optional(Schema.NumberFromString),
  sort: Schema.optional(Schema.String),
  direction: Schema.optional(Schema.Union([Schema.Literal("asc"), Schema.Literal("desc")])),
});

export const searchQuerySchema = Schema.toStandardSchemaV1(SearchQuerySchema);

export const CustomerBodySchema = Schema.Struct({
  email: Schema.String,
  name: Schema.optional(Schema.String),
  externalId: Schema.String,
});

export const customerBodySchema = Schema.toStandardSchemaV1(CustomerBodySchema);

export const guestbookSessionCookieSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    guestbook_session: Schema.optional(Schema.String),
    // Elysia JSON-parses object-shaped cookie values, so the user cookie can
    // arrive as either the raw JSON string or the parsed object.
    guestbook_user: Schema.optional(Schema.Unknown),
  }),
);

export const guestbookUserCookieSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    // Elysia JSON-parses object-shaped cookie values, so the user cookie can
    // arrive as either the raw JSON string or the parsed object.
    guestbook_user: Schema.optional(Schema.Unknown),
  }),
);

export const handleBodySchema = Schema.toStandardSchemaV1(Schema.Struct({ handle: Schema.String }));

export const messageBodySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ message: Schema.String }),
);

export const callbackQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ code: Schema.String }),
);

export const authUrlResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ authUrl: Schema.String }),
);

export const successResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ success: Schema.Boolean }),
);

export const errorResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ error: Schema.String }),
);

import { Schema } from "effect";
import { problemDetailsSchema as sharedProblemDetailsSchema } from "@tom/schemas/error";

export const PaginationQuerySchema = Schema.Struct({
  page: Schema.optional(Schema.FiniteFromString),
  per: Schema.optional(Schema.FiniteFromString),
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
  page: Schema.optional(Schema.FiniteFromString),
  per: Schema.optional(Schema.FiniteFromString),
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
    guestbook_user: Schema.optional(Schema.Json),
  }),
);

export const guestbookUserCookieSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    // Elysia JSON-parses object-shaped cookie values, so the user cookie can
    // arrive as either the raw JSON string or the parsed object.
    guestbook_user: Schema.optional(Schema.Json),
  }),
);

export const handleBodySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ handle: Schema.NonEmptyString }),
);

export const messageBodySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ message: Schema.NonEmptyString }),
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

/**
 * One guestbook entry on the wire. `created_at`/`updated_at` are ISO strings,
 * not the `Date` objects Postgres returns: Kysely types the column as
 * `Date | string`, and that union leaked all the way into the web client
 * through Eden, where the value is a string at runtime. Declaring the response
 * keeps the type honest.
 */
export const GuestbookEntrySchema = Schema.Struct({
  id: Schema.Finite,
  fediverse_username: Schema.String,
  fediverse_instance: Schema.String,
  display_name: Schema.NullOr(Schema.String),
  avatar_url: Schema.NullOr(Schema.String),
  message: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
});

export const guestbookEntriesSchema = Schema.toStandardSchemaV1(Schema.Array(GuestbookEntrySchema));

export const problemDetailsSchema = Schema.toStandardSchemaV1(sharedProblemDetailsSchema);

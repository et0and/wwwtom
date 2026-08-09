import { Schema } from "effect";

export class ImageError extends Schema.TaggedErrorClass<ImageError>()("ImageError", {
  response: Schema.Unknown,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PolarApiError extends Schema.TaggedErrorClass<PolarApiError>()("PolarApiError", {
  message: Schema.String,
  status: Schema.Number,
  operation: Schema.String,
}) {}

export class ArenaConfigError extends Schema.TaggedErrorClass<ArenaConfigError>()(
  "ArenaConfigError",
  {
    message: Schema.String,
  },
) {}

export class SearchError extends Schema.TaggedErrorClass<SearchError>()("SearchError", {
  message: Schema.String,
}) {}

export class HttpError extends Schema.TaggedErrorClass<HttpError>()("HttpError", {
  message: Schema.String,
  status: Schema.Number,
}) {}

export class DatabaseConnectionError extends Schema.TaggedErrorClass<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class StoredProcedureError extends Schema.TaggedErrorClass<StoredProcedureError>()(
  "StoredProcedureError",
  {
    procedure: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class GuestbookValidationError extends Schema.TaggedErrorClass<GuestbookValidationError>()(
  "GuestbookValidationError",
  {
    message: Schema.String,
    field: Schema.optional(Schema.String),
  },
) {}

export class OAuthSessionError extends Schema.TaggedErrorClass<OAuthSessionError>()(
  "OAuthSessionError",
  {
    message: Schema.String,
    sessionToken: Schema.optional(Schema.String),
  },
) {}

export class MissingFieldError extends Schema.TaggedErrorClass<MissingFieldError>()(
  "MissingFieldError",
  {
    field: Schema.String,
  },
) {}

export class ProfanityError extends Schema.TaggedErrorClass<ProfanityError>()("ProfanityError", {
  message: Schema.String,
}) {}

export class AuthenticationError extends Schema.TaggedErrorClass<AuthenticationError>()(
  "AuthenticationError",
  {
    message: Schema.String,
  },
) {}

export class NodeinfoError extends Schema.TaggedErrorClass<NodeinfoError>()("NodeinfoError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class FontFetchError extends Schema.TaggedErrorClass<FontFetchError>()("FontFetchError", {
  message: Schema.String,
  cause: Schema.String,
}) {}

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()("ValidationError", {
  field: Schema.String,
  issue: Schema.String,
}) {}

export class ImageGenerationError extends Schema.TaggedErrorClass<ImageGenerationError>()(
  "ImageGenerationError",
  {
    message: Schema.String,
  },
) {}

export class TelegramError extends Schema.TaggedErrorClass<TelegramError>()("TelegramError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
}) {}

export class InfrastructureConfigError extends Schema.TaggedErrorClass<InfrastructureConfigError>()(
  "InfrastructureConfigError",
  {
    variable: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class SecretsError extends Schema.TaggedErrorClass<SecretsError>()("SecretsError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

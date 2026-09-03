import { Schema } from "effect";

const messageFields = { message: Schema.String };

const messageCauseFields = {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
};

export class ImageError extends Schema.TaggedError<ImageError>()("ImageError", {
  response: Schema.Unknown,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PolarApiError extends Schema.TaggedError<PolarApiError>()("PolarApiError", {
  message: Schema.String,
  status: Schema.Number,
  operation: Schema.String,
}) {}

export class ArenaConfigError extends Schema.TaggedError<ArenaConfigError>()(
  "ArenaConfigError",
  messageFields,
) {}

export class SearchError extends Schema.TaggedError<SearchError>()("SearchError", messageFields) {}

export class HttpError extends Schema.TaggedError<HttpError>()("HttpError", {
  message: Schema.String,
  status: Schema.Number,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class DatabaseConnectionError extends Schema.TaggedError<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  messageCauseFields,
) {}

export class StoredProcedureError extends Schema.TaggedError<StoredProcedureError>()(
  "StoredProcedureError",
  {
    procedure: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class GuestbookValidationError extends Schema.TaggedError<GuestbookValidationError>()(
  "GuestbookValidationError",
  {
    message: Schema.String,
    field: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class OAuthSessionError extends Schema.TaggedError<OAuthSessionError>()(
  "OAuthSessionError",
  {
    message: Schema.String,
    sessionToken: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class MissingFieldError extends Schema.TaggedError<MissingFieldError>()(
  "MissingFieldError",
  {
    field: Schema.String,
  },
) {}

export class ProfanityError extends Schema.TaggedError<ProfanityError>()(
  "ProfanityError",
  messageFields,
) {}

export class AuthenticationError extends Schema.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  messageFields,
) {}

export class NodeinfoError extends Schema.TaggedError<NodeinfoError>()(
  "NodeinfoError",
  messageCauseFields,
) {}

export class FontFetchError extends Schema.TaggedError<FontFetchError>()("FontFetchError", {
  message: Schema.String,
  cause: Schema.String,
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  field: Schema.String,
  issue: Schema.String,
}) {}

export class ImageGenerationError extends Schema.TaggedError<ImageGenerationError>()(
  "ImageGenerationError",
  messageFields,
) {}

export class TelegramError extends Schema.TaggedError<TelegramError>()("TelegramError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
}) {}

export class InfrastructureConfigError extends Schema.TaggedError<InfrastructureConfigError>()(
  "InfrastructureConfigError",
  {
    variable: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class SecretsError extends Schema.TaggedError<SecretsError>()(
  "SecretsError",
  messageCauseFields,
) {}

export class WorkerEnvMissingError extends Schema.TaggedError<WorkerEnvMissingError>()(
  "WorkerEnvMissingError",
  messageFields,
) {}

export class QueueError extends Schema.TaggedError<QueueError>()(
  "QueueError",
  messageCauseFields,
) {}

export class RunnerError extends Schema.TaggedError<RunnerError>()(
  "RunnerError",
  messageCauseFields,
) {}

export class GitHubApiError extends Schema.TaggedError<GitHubApiError>()("GitHubApiError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class TurboCacheError extends Schema.TaggedError<TurboCacheError>()(
  "TurboCacheError",
  messageCauseFields,
) {}

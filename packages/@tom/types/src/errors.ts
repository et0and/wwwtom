import { Data } from "effect";

export class ImageError extends Data.TaggedError("ImageError")<{
  readonly response: Response;
  readonly cause?: unknown;
}> {}

export class PolarApiError extends Data.TaggedError("PolarApiError")<{
  readonly message: string;
  readonly status: number;
  readonly operation: string;
}> {}

export class ArenaConfigError extends Data.TaggedError("ArenaConfigError")<{
  readonly message: string;
}> {}

export class SearchError extends Data.TaggedError("SearchError")<{
  message: string;
}> {}

export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status: number;
}> {}

export class DatabaseConnectionError extends Data.TaggedError("DatabaseConnectionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class StoredProcedureError extends Data.TaggedError("StoredProcedureError")<{
  readonly procedure: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class GuestbookValidationError extends Data.TaggedError("GuestbookValidationError")<{
  readonly message: string;
  readonly field?: string;
}> {}

export class OAuthSessionError extends Data.TaggedError("OAuthSessionError")<{
  readonly message: string;
  readonly sessionToken?: string;
}> {}

export class MissingFieldError extends Data.TaggedError("MissingFieldError")<{
  readonly field: string;
}> {}

export class ProfanityError extends Data.TaggedError("ProfanityError")<{
  readonly message: string;
}> {}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly message: string;
}> {}

export class NodeinfoError extends Data.TaggedError("NodeinfoError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FontFetchError extends Data.TaggedError("FontFetchError") {
  constructor(
    readonly message: string,
    readonly cause: string,
  ) {
    super();
  }
}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly issue: string;
}> {}

export class ImageGenerationError extends Data.TaggedError("ImageGenerationError")<{
  readonly message: string;
}> {}

export class TelegramError extends Data.TaggedError("TelegramError")<{
  readonly message: string;
  readonly status?: number;
}> {}

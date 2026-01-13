import { Data } from "effect";

export class RepositoryError extends Data.TaggedError("RepositoryError")<{
  readonly message: string;
  readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "DATABASE_ERROR";
  readonly cause?: unknown;
}> {}

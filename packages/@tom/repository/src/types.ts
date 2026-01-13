export type RepositoryErrorCodes = "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "DATABASE_ERROR";

export interface Timestamps {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

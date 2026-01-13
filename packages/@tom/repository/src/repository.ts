import { Effect } from "effect";
import { RepositoryError } from "./errors";

export interface Repository<A, Id> {
  readonly findById: (id: Id) => Effect.Effect<A, RepositoryError>;
  readonly findAll: () => Effect.Effect<ReadonlyArray<A>, RepositoryError>;
  readonly create: (entity: Omit<A, "id" | "createdAt">) => Effect.Effect<A, RepositoryError>;
  readonly update: (id: Id, updates: Partial<A>) => Effect.Effect<A, RepositoryError>;
  readonly delete: (id: Id) => Effect.Effect<void, RepositoryError>;
}

export interface PaginatedResult<A> {
  readonly items: ReadonlyArray<A>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
}

import { Effect, Schema } from "effect";
import {
  getEntry,
  listEntries,
  type ArenaContentClient,
  type ArenaContentPaging,
} from "@tom/arena/content";
import { ArenaService } from "@tom/arena/service";
import type { ArenaApi } from "@tom/arena/client";
import type { PaginationAttributes } from "@tom/schemas/arena";
import type { ArenaEntry, ArenaEntryList, ArenaEntrySummary } from "@tom/schemas/arena-content";
import { ARENA_POSTS_CHANNEL_SLUG } from "@tom/constants/arena";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { retryPolicy } from "@tom/utils/retry";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import type { LogContext } from "@tom/utils/logging";
import { AdapterError, createArenaLayer, runAdapter } from "../runtime";
import { tenantFromValue } from "../origins";
import { simulatorEnv } from "../simulator";
import { paginationQuerySchema, searchQuerySchema, type PaginationQuery } from "../schemas";

export { paginationQuerySchema, searchQuerySchema };
export type { PaginationQuery };

export const ChannelSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String }),
);

export const IdOrSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Union([Schema.FiniteFromString, Schema.String]),
  }),
);

export const BlockIdParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Finite }));

/**
 * The pagination fields the caller set, or `undefined` when none were. Keys
 * without a value are omitted rather than passed as `undefined`: the Arena
 * client spreads these over its defaults, so an explicit `per: undefined`
 * would clobber the default page size.
 */
export const toPaginationAttributes = (
  query: PaginationQuery,
): PaginationAttributes | undefined => {
  const { page, per, sort, direction } = query;
  if ([page, per, sort, direction].every((value) => value === undefined)) return undefined;
  return {
    ...(page !== undefined && { page }),
    ...(per !== undefined && { per }),
    ...(sort !== undefined && { sort }),
    ...(direction !== undefined && { direction }),
  };
};

const arenaOperation = <T>(
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  mode: "auth" | "public" = "auth",
) =>
  Effect.gen(function* () {
    const arena = yield* ArenaService;
    const client = mode === "public" ? arena.publicClient : arena.client;
    // Retry only upstream failures: 404s are answers, and retrying 429s
    // ignores are.na's Retry-After and extends the rate-limit window.
    return yield* operation(client).pipe(
      Effect.retry({
        schedule: retryPolicy,
        while: (error) => error.status >= HttpStatus.InternalServerError,
      }),
    );
  });

export const runArena = <T>(
  request: Request,
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  context: LogContext,
  mode: "auth" | "public" = "auth",
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(getRequestEnv(request))).pipe(
      Effect.flatMap((resolved) =>
        arenaOperation(operation, mode).pipe(
          Effect.provide(createArenaLayer(simulatorEnv(resolved, request))),
        ),
      ),
      Effect.mapError((error) =>
        Schema.is(HttpError)(error)
          ? error
          : new HttpError({
              message: error.message,
              status: HttpStatus.InternalServerError,
              cause: error,
            }),
      ),
    ),
    (error) => new AdapterError({ status: error.status, message: error.message }),
    context,
  );

/**
 * are.na-backed content for Tom. These routes serve every tenant except
 * Sophie — local dev and tests run without TENANT. Sophie keeps the D1 CMS
 * on /content/*.
 */
export const requireArenaTenant = (request: Request): void => {
  if (tenantFromValue(getRequestEnv(request).TENANT) === "sophie") {
    throw new AdapterError({ status: HttpStatus.NotFound, message: "Not found" });
  }
};

/**
 * Content reads use the public client: the master channels and their entries
 * are closed, which are.na serves to anonymous readers. The account token is
 * never needed here, so responses stay honestly cacheable.
 */
const runContent = <T>(
  request: Request,
  operation: (client: ArenaContentClient) => Effect.Effect<T, HttpError>,
): Promise<T> =>
  runArena(request, operation, logContextFromRequest(request, "tom-adapter"), "public");

export const listArenaContent = (
  request: Request,
  indexSlug: string,
  paging?: ArenaContentPaging,
): Promise<ArenaEntryList> =>
  runContent(request, (client) => listEntries(client, indexSlug, paging));

export const getArenaContent = async (
  request: Request,
  indexSlug: string,
  entrySlug: string,
  resource: "Post" | "Work",
): Promise<ArenaEntry> => {
  const entry = await runContent(request, (client) => getEntry(client, indexSlug, entrySlug));
  if (entry === null) {
    throw new AdapterError({ status: HttpStatus.NotFound, message: `${resource} not found` });
  }
  return entry;
};

interface ArenaFeedDoc {
  readonly id: number;
  readonly title: string;
  readonly summary: string;
  readonly slug: string;
  readonly publishedAt: string;
  readonly content: string;
}

const feedDoc = (entry: ArenaEntrySummary): ArenaFeedDoc => ({
  id: entry.id,
  title: entry.title,
  summary: entry.summary ?? "",
  slug: entry.slug,
  publishedAt: entry.publishedAt,
  content: entry.summary ?? "",
});

export const arenaFeed = async (
  request: Request,
  limit: number,
): Promise<{ docs: ArenaFeedDoc[] }> => {
  const entries = await listArenaContent(request, ARENA_POSTS_CHANNEL_SLUG, {
    page: 1,
    per: limit,
  });
  return { docs: entries.docs.map(feedDoc) };
};

export const arenaListQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.FiniteFromString),
    pageSize: Schema.optional(Schema.FiniteFromString),
  }),
);

export const arenaSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String }),
);

export const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
);

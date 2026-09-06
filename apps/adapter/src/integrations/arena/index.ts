import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { ArenaApi } from "@tom/arena/client";
import type { PaginationAttributes } from "@tom/schemas/arena";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { simulatorEnv } from "../../simulator";
import { retryPolicy } from "@tom/utils/retry";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { AdapterError, createArenaLayer, runAdapter } from "../../config/effect";
import { paginationQuerySchema, searchQuerySchema, type PaginationQuery } from "../../schemas";

const ChannelSlugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

const IdOrSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Union([Schema.NumberFromString, Schema.String]),
  }),
);

const BlockIdParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Number }));

const toPaginationAttributes = (query: PaginationQuery): PaginationAttributes | undefined => {
  const hasAny =
    query.page !== undefined ||
    query.per !== undefined ||
    query.sort !== undefined ||
    query.direction !== undefined;
  if (!hasAny) return undefined;
  return {
    ...(query.page !== undefined && { page: query.page }),
    ...(query.per !== undefined && { per: query.per }),
    ...(query.sort !== undefined && { sort: query.sort }),
    ...(query.direction !== undefined && { direction: query.direction }),
  };
};

const arenaOperation = <T>(
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  mode: "auth" | "public" = "auth",
) =>
  Effect.gen(function* () {
    const arena = yield* ArenaService;
    const client = mode === "public" ? arena.publicClient : arena.client;
    return yield* operation(client).pipe(Effect.retry(retryPolicy));
  });

const runArena = <T>(
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
        error instanceof HttpError
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

export const arenaIntegration = new Elysia({ name: "arena" })
  .get(
    "/arena/channels",
    ({ query, request }) => {
      return runArena(
        request,
        (client) => client.channels(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: paginationQuerySchema,
      detail: { description: "List channels (authenticated)", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.channel(params.slug).get(),
        logContextFromRequest(request, "tom-adapter"),
        "public",
      );
    },
    {
      params: ChannelSlugParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get a channel by slug", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug/contents",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.channel(params.slug).contents(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
        "public",
      );
    },
    {
      params: ChannelSlugParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get channel contents", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug/thumb",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.channel(params.slug).thumb(),
        logContextFromRequest(request, "tom-adapter"),
        "public",
      );
    },
    {
      params: ChannelSlugParamsSchema,
      detail: { description: "Get channel thumbnail", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).get(),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/channels",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).channels(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get a user's channels", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/following",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).following(),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user's following", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/followers",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).followers(),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user's followers", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.block(params.id).get(),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: BlockIdParamsSchema,
      detail: { description: "Get a block", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id/channels",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.block(params.id).channels(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: BlockIdParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get channels a block belongs to", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id/comments",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.block(params.id).comments(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: BlockIdParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get block comments", tags: ["arena"] },
    },
  )
  .get(
    "/arena/search",
    ({ query, request }) => {
      return runArena(
        request,
        (client) => {
          const options = toPaginationAttributes(query);
          switch (query.type) {
            case "channels":
              return client.search.channels(query.query, options);
            case "blocks":
              return client.search.blocks(query.query, options);
            case "users":
              return client.search.users(query.query, options);
            default:
              return client.search.everything(query.query, options);
          }
        },
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: searchQuerySchema,
      detail: { description: "Search Are.na", tags: ["arena"] },
    },
  );

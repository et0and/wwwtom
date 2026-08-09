import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { ArenaApi } from "@tom/arena/client";
import type { PaginationAttributes } from "@tom/schemas/arena";
import { HttpError } from "@tom/types/errors";
import { retryPolicy } from "@tom/utils/retry";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, toErrorMessage } from "@tom/utils/services/worker";
import { AdapterError, createArenaLayer, runAdapter } from "../../config/effect";
import { paginationQuerySchema, searchQuerySchema, type PaginationQuery } from "../../schemas";
import type { CloudflareEnv } from "@tom/utils/services/config";

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
    ...(query.page !== undefined ? { page: query.page } : {}),
    ...(query.per !== undefined ? { per: query.per } : {}),
    ...(query.sort !== undefined ? { sort: query.sort } : {}),
    ...(query.direction !== undefined ? { direction: query.direction } : {}),
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
  env: CloudflareEnv,
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  mode: "auth" | "public" = "auth",
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(env)).pipe(
      Effect.flatMap((resolved) =>
        arenaOperation(operation, mode).pipe(Effect.provide(createArenaLayer(resolved))),
      ),
      Effect.mapError((error) =>
        error instanceof HttpError
          ? error
          : new HttpError({ message: toErrorMessage(error), status: 500 }),
      ),
    ),
    (error) => new AdapterError(error.status, error.message),
  );

export const arenaIntegration = new Elysia({ name: "arena" })
  .get(
    "/arena/channels",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      return runArena(env, (client) => client.channels(toPaginationAttributes(query)));
    },
    {
      query: paginationQuerySchema,
      detail: { description: "List channels (authenticated)", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug",
    ({ params, query, request }) => {
      const env = getRequestEnv(request);
      return runArena(
        env,
        (client) => client.channel(params.slug).get(toPaginationAttributes(query)),
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
      const env = getRequestEnv(request);
      return runArena(
        env,
        (client) => client.channel(params.slug).contents(toPaginationAttributes(query)),
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
      const env = getRequestEnv(request);
      return runArena(env, (client) => client.channel(params.slug).thumb(), "public");
    },
    {
      params: ChannelSlugParamsSchema,
      detail: { description: "Get channel thumbnail", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runArena(env, (client) => client.user(params.id).get());
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/channels",
    ({ params, query, request }) => {
      const env = getRequestEnv(request);
      return runArena(env, (client) =>
        client.user(params.id).channels(toPaginationAttributes(query)),
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
      const env = getRequestEnv(request);
      return runArena(env, (client) => client.user(params.id).following());
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user's following", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/followers",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runArena(env, (client) => client.user(params.id).followers());
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user's followers", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runArena(env, (client) => client.block(params.id).get());
    },
    {
      params: BlockIdParamsSchema,
      detail: { description: "Get a block", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id/channels",
    ({ params, query, request }) => {
      const env = getRequestEnv(request);
      return runArena(env, (client) =>
        client.block(params.id).channels(toPaginationAttributes(query)),
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
      const env = getRequestEnv(request);
      return runArena(env, (client) =>
        client.block(params.id).comments(toPaginationAttributes(query)),
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
      const env = getRequestEnv(request);
      return runArena(env, (client) => {
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
      });
    },
    {
      query: searchQuerySchema,
      detail: { description: "Search Are.na", tags: ["arena"] },
    },
  );

import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { HttpError } from "@tom/types/errors";
import { AddressSchema, MetaSchema } from "@tom/schemas/address";
import { callApi } from "../../callApi";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import { AdapterError, runAdapter } from "../../config/effect";
import { simulatorEnv } from "../../simulator";

const SearchQuerySchema = Schema.Struct({
  q: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  limit: Schema.optional(Schema.String),
  bbox: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
});

const RawMetaSchema = Schema.Struct({
  version: Schema.String,
  totalAddresses: Schema.Number,
  lastUpdated: Schema.Union([Schema.String, Schema.Date]),
});

const searchQuerySchema = Schema.toStandardSchemaV1(SearchQuerySchema);
const addressSearchResponseSchema = Schema.toStandardSchemaV1(Schema.Array(AddressSchema));
const metaResponseSchema = Schema.toStandardSchemaV1(MetaSchema);
const ErrorBodySchema = Schema.Struct({ error: Schema.String });
const EdenErrorSchema = Schema.Struct({
  status: Schema.Unknown,
  value: Schema.Unknown,
});

export const addressIntegration = new Elysia({ name: "address" })
  .get(
    "/address/search",
    async ({ query, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      const api = callApi(apiUrl, env.INTERNAL_API_TOKEN);

      const program = Effect.gen(function* () {
        const qValue = Array.isArray(query.q) ? query.q.join(",") : query.q;
        const limitValue =
          query.limit && Array.isArray(query.limit) ? query.limit.join(",") : query.limit;
        const bboxValue =
          query.bbox && Array.isArray(query.bbox) ? query.bbox.join(",") : query.bbox;
        yield* Effect.logInfo("address:search:proxy", {
          q: qValue,
          limit: limitValue,
          bbox: bboxValue,
        });

        const baseQuery = { q: qValue };
        const withLimit =
          limitValue !== undefined ? { ...baseQuery, limit: limitValue } : baseQuery;
        const apiQuery = bboxValue !== undefined ? { ...withLimit, bbox: bboxValue } : withLimit;

        const apiKeyHeader = request.headers.get("x-api-key");
        const result = yield* Effect.tryPromise({
          try: () =>
            api.v1.search.get(
              Object.assign(
                { query: apiQuery },
                apiKeyHeader ? { headers: { "x-api-key": apiKeyHeader } } : {},
              ),
            ),
          catch: (cause) =>
            new HttpError({ message: "Failed to proxy address search", status: 502, cause }),
        });

        if (result.error) {
          const errorOption = Schema.decodeUnknownOption(EdenErrorSchema)(result.error);
          const status = Option.match(errorOption, {
            onNone: () => 502,
            onSome: (err) => {
              const maybeNumber = Schema.decodeUnknownOption(Schema.NumberFromString)(
                String(err.status),
              );
              if (Option.isSome(maybeNumber)) return maybeNumber.value;
              const asNumber = Schema.decodeUnknownOption(Schema.Number)(err.status);
              return Option.isSome(asNumber) ? asNumber.value : 502;
            },
          });

          const valueOption = Schema.decodeUnknownOption(Schema.Struct({ value: Schema.Unknown }))(
            result.error,
          );
          let message = "Address search failed";
          if (Option.isSome(valueOption)) {
            const maybeBody = Schema.decodeUnknownOption(ErrorBodySchema)(valueOption.value.value);
            if (Option.isSome(maybeBody)) message = maybeBody.value.error;
          }

          return yield* new HttpError({ message, status });
        }

        const data = result.data ?? [];
        return Schema.decodeUnknownSync(Schema.Array(AddressSchema))(data);
      });

      return runAdapter(
        program,
        (error) => new AdapterError(error.status || 500, error.message),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: searchQuerySchema,
      response: {
        200: addressSearchResponseSchema,
        400: Schema.toStandardSchemaV1(Schema.Struct({ error: Schema.String })),
        500: Schema.toStandardSchemaV1(Schema.Struct({ error: Schema.String })),
      },
      detail: {
        description:
          "Proxy NZ address search to Tom API (tsvector) — typed Eden treaty via adapter",
        tags: ["address"],
      },
    },
  )
  .get(
    "/address/meta",
    async ({ request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      const api = callApi(apiUrl, env.INTERNAL_API_TOKEN);

      const program = Effect.gen(function* () {
        yield* Effect.logInfo("address:meta:proxy", { apiUrl });
        const result = yield* Effect.tryPromise({
          try: () => api.v1.meta.get(),
          catch: (cause) =>
            new HttpError({ message: "Failed to proxy address meta", status: 502, cause }),
        });
        if (result.error) {
          yield* Effect.logError("address:meta:proxy:error", {
            status: result.status,
            error: result.error,
          });
          return yield* new HttpError({
            message: "Address meta failed",
            status: 502,
            cause: result.error,
          });
        }
        const raw = yield* Effect.try({
          try: () => Schema.decodeUnknownSync(RawMetaSchema)(result.data),
          catch: (cause) =>
            new HttpError({
              message: "Meta decode failed",
              status: 502,
              cause,
            }),
        });
        const normalized =
          raw.lastUpdated instanceof Date
            ? { ...raw, lastUpdated: raw.lastUpdated.toISOString() }
            : raw;
        return Schema.decodeUnknownSync(MetaSchema)(normalized);
      });

      return runAdapter(
        program,
        (error) => new AdapterError(error.status || 500, error.message),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      response: { 200: metaResponseSchema },
      detail: { description: "Proxy address dataset meta", tags: ["address"] },
    },
  );

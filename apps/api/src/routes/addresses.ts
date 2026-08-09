import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import type { HttpError } from "@tom/types/errors";
import { errorResponseSchema } from "@tom/schemas/error";
import {
  logContextFromRequest,
  runEffect,
  toErrorResponse,
  type RequestWithEnv,
} from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
import type { AddressServices, AuthResult } from "../services/address";
import type { Bbox } from "../services/address/addresses";
import { addressServicesFromRequest } from "../services/address";

const addressSchema = Schema.Struct({
  addressId: Schema.Number,
  fullAddress: Schema.String,
  fullAddressNumber: Schema.String,
  fullAddressRoad: Schema.NullishOr(Schema.String),
  suburb: Schema.String,
  townCity: Schema.String,
  territorialAuthority: Schema.String,
  region: Schema.NullishOr(Schema.String),
  postcode: Schema.NullishOr(Schema.String),
  longitude: Schema.Number,
  latitude: Schema.Number,
});

const addressListSchema = Schema.Array(addressSchema);

const metaSchema = Schema.Struct({
  version: Schema.String,
  totalAddresses: Schema.Number,
  lastUpdated: Schema.String,
});

const challengeSchema = Schema.Struct({
  challenge: Schema.String,
  token: Schema.String,
  difficulty: Schema.Number,
  expiresAt: Schema.Number,
});

const keyRequestSchema = Schema.Struct({
  challenge: Schema.String,
  nonce: Schema.Number,
  token: Schema.String,
});

const keyResponseSchema = Schema.Struct({
  apiKey: Schema.String,
  rateLimit: Schema.Number,
});

const ingestResponseSchema = Schema.Struct({
  status: Schema.String,
  queueMessageId: Schema.String,
});

const errorSchema = errorResponseSchema;

const notFoundSchema = errorResponseSchema.pipe(
  Schema.annotate({ description: "Address not found" }),
);

const proofErrorSchema = errorResponseSchema.pipe(
  Schema.annotate({ description: "Proof-of-work missing, expired, or invalid" }),
);

const forbiddenSchema = errorResponseSchema.pipe(
  Schema.annotate({ description: "Missing or invalid admin key" }),
);

const bboxParamSchema = Schema.Union([Schema.String, Schema.Array(Schema.String)]).pipe(
  Schema.annotate({
    description: "Bounding box filter as minLng,minLat,maxLng,maxLat",
    examples: ["174.77,-41.29,174.79,-41.28"],
  }),
);

const searchQuerySchema = toOpenApiSchema(
  Schema.Struct({
    q: Schema.String.pipe(
      Schema.annotate({
        description: "Search query string",
        examples: ["lambton quay"],
      }),
    ),
    bbox: Schema.optional(bboxParamSchema),
    limit: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Maximum results (default: 100, max: 1000)" }),
    ),
    format: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: 'Response format - "full" or "simple"' }),
    ),
  }),
);

const reverseQuerySchema = toOpenApiSchema(
  Schema.Struct({
    lat: Schema.String.pipe(
      Schema.annotate({ description: "Latitude in decimal degrees", examples: ["-41.2865"] }),
    ),
    lng: Schema.String.pipe(
      Schema.annotate({ description: "Longitude in decimal degrees", examples: ["174.7762"] }),
    ),
    limit: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Maximum results (default: 10, max: 100)" }),
    ),
    format: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: 'Response format - "full" or "simple"' }),
    ),
  }),
);

const listQuerySchema = toOpenApiSchema(
  Schema.Struct({
    limit: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Maximum results (default: 100, max: 1000)" }),
    ),
    offset: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Number of results to skip" }),
    ),
    format: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: 'Response format - "full" or "simple"' }),
    ),
    town_city: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Filter by town/city name", examples: ["Wellington"] }),
    ),
    suburb_locality: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Filter by suburb/locality", examples: ["Te Aro"] }),
    ),
    road_name: Schema.optional(Schema.String).pipe(
      Schema.annotate({ description: "Filter by road/street name", examples: ["Lambton Quay"] }),
    ),
    bbox: Schema.optional(bboxParamSchema),
  }),
);

const parseLimit = (raw: string | undefined, fallback: number, max: number): number => {
  const value = parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, max) : fallback;
};

const bboxValue = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === "string" ? value : value?.join(",");

const parseBbox = (value: string): Bbox => {
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("bbox must have 4 comma-separated values");
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (
    minLng === undefined ||
    minLat === undefined ||
    maxLng === undefined ||
    maxLat === undefined
  ) {
    throw new Error("bbox must have 4 comma-separated values");
  }
  return [minLng, minLat, maxLng, maxLat];
};

const ipOf = (request: Request): string => request.headers.get("cf-connecting-ip") ?? "unknown";

const authResponse = (result: AuthResult): Response | undefined => {
  if (result.allowed) return undefined;
  const response = toErrorResponse(result.status ?? 401, result.message ?? "Unauthorized");
  if (result.retryAfter) response.headers.set("Retry-After", String(result.retryAfter));
  return response;
};

export const createAddressRoutes = (
  getServices: (request: Request) => Promise<AddressServices>,
) => {
  const runRoute = <A>(
    effect: Effect.Effect<A, HttpError>,
    request: Request,
  ): Promise<A | Response> =>
    runEffect(
      effect.pipe(
        Effect.catch((error) => Effect.succeed(toErrorResponse(error.status, error.message))),
      ),
      logContextFromRequest(request, "tom-api"),
    );

  const requireApiKey = async ({
    headers,
    request,
  }: {
    headers: Record<string, string | undefined>;
    request: Request;
  }): Promise<Response | undefined> => {
    const services = await getServices(request);
    const result = await runEffect(
      services.authenticateApiKey(headers["x-api-key"], ipOf(request)),
      logContextFromRequest(request, "tom-api"),
    );
    return authResponse(result);
  };

  const requireAdmin = async ({
    headers,
    request,
  }: {
    headers: Record<string, string | undefined>;
    request: Request;
  }): Promise<Response | undefined> => {
    const services = await getServices(request);
    const result = await runEffect(
      services.authenticateAdmin(headers["x-admin-key"]),
      logContextFromRequest(request, "tom-api"),
    );
    return authResponse(result);
  };

  return new Elysia({ name: "address" })
    .get(
      "/challenge",
      async ({ request }) => {
        const services = await getServices(request);
        return runRoute(services.getChallenge(), request);
      },
      {
        response: {
          200: toOpenApiSchema(
            challengeSchema.pipe(Schema.annotate({ description: "Proof-of-work challenge" })),
          ),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Get proof-of-work challenge",
          description:
            "Returns a cryptographic challenge for proof-of-work based API key registration. Solve it with POST /request-key to obtain an API key.",
          tags: ["address"],
        },
      },
    )
    .post(
      "/request-key",
      async ({ body, request }) => {
        const services = await getServices(request);
        const payload = body as { challenge: string; nonce: number; token: string };
        return runRoute(
          services.requestApiKey(payload.challenge, payload.nonce, payload.token),
          request,
        );
      },
      {
        body: toOpenApiSchema(keyRequestSchema),
        response: {
          200: toOpenApiSchema(
            keyResponseSchema.pipe(Schema.annotate({ description: "New API key" })),
          ),
          428: toOpenApiSchema(proofErrorSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Request API key",
          description:
            "Submit a proof-of-work solution to obtain an API key. Prevents automated abuse while allowing legitimate users to access the API.",
          tags: ["address"],
        },
      },
    )
    .post(
      "/ingest-init",
      async ({ request }) => {
        const services = await getServices(request);
        const outcome = await runEffect(
          services.startIngestion().pipe(
            Effect.match({
              onSuccess: (start) => ({ start }),
              onFailure: (error) => ({ error }),
            }),
          ),
          logContextFromRequest(request, "tom-api"),
        );

        if ("error" in outcome) {
          return toErrorResponse(outcome.error.status, outcome.error.message);
        }

        const { start } = outcome;
        if (start.status === "queued" && start.runId && start.version && start.total) {
          const job = runEffect(
            services.ingestRun(start.runId, start.version, start.total).pipe(
              Effect.catch((error) =>
                Effect.logError("Address ingestion run failed", {
                  runId: start.runId,
                  error: error.message,
                }),
              ),
            ),
            logContextFromRequest(request, "tom-api"),
          );
          const ctx = (request as RequestWithEnv).ctx;
          if (ctx) ctx.waitUntil(job);
          else void job;
        }

        return { status: start.status, queueMessageId: start.version ?? "" };
      },
      {
        beforeHandle: requireAdmin,
        response: {
          200: toOpenApiSchema(
            ingestResponseSchema.pipe(Schema.annotate({ description: "Ingestion job status" })),
          ),
          403: toOpenApiSchema(forbiddenSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Trigger data ingestion",
          description:
            "Initiates ingestion of fresh data from the LINZ API. Runs in the background; returns immediately with the job status.",
          tags: ["address"],
        },
      },
    )
    .get(
      "/v1/addresses/:id",
      async ({ params, request }) => {
        const services = await getServices(request);
        const id = Number(params.id);
        return runRoute(
          services
            .getAddressById(id)
            .pipe(Effect.map((address) => address ?? toErrorResponse(404, "address not found"))),
          request,
        );
      },
      {
        beforeHandle: requireApiKey,
        response: {
          200: toOpenApiSchema(
            addressSchema.pipe(Schema.annotate({ description: "Address record" })),
          ),
          404: toOpenApiSchema(notFoundSchema),
          401: toOpenApiSchema(errorSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Get address by ID",
          description:
            "Retrieve a single address record by its LINZ address_id, the canonical identifier assigned by Land Information New Zealand.",
          tags: ["address"],
        },
      },
    )
    .get(
      "/v1/addresses",
      async ({ query, request }) => {
        const services = await getServices(request);
        const limit = parseLimit(query.limit, 100, 1000);
        const offset = Math.max(0, parseInt(query.offset ?? "0", 10) || 0);
        let bbox: Bbox | undefined;
        const bboxParam = bboxValue(query.bbox);
        if (bboxParam) {
          try {
            bbox = parseBbox(bboxParam);
          } catch {
            return toErrorResponse(
              400,
              "Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat",
            );
          }
        }
        return runRoute(
          services.listAddresses({
            limit,
            offset,
            townCity: query.town_city,
            suburbLocality: query.suburb_locality,
            roadName: query.road_name,
            bbox,
          }),
          request,
        );
      },
      {
        beforeHandle: requireApiKey,
        query: listQuerySchema,
        response: {
          200: toOpenApiSchema(
            addressListSchema.pipe(Schema.annotate({ description: "List of address records" })),
          ),
          400: toOpenApiSchema(errorSchema),
          401: toOpenApiSchema(errorSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "List addresses",
          description:
            "Retrieve a paginated list of addresses with optional filtering by town/city, suburb, road name, or bounding box.",
          tags: ["address"],
        },
      },
    )
    .get(
      "/v1/search",
      async ({ query, request }) => {
        const services = await getServices(request);
        if (!query.q || query.q.trim().length === 0) {
          return toErrorResponse(400, "Search query is required");
        }
        const limit = parseLimit(query.limit, 100, 1000);
        let bbox: Bbox | undefined;
        const bboxParam = bboxValue(query.bbox);
        if (bboxParam) {
          try {
            bbox = parseBbox(bboxParam);
          } catch {
            return toErrorResponse(
              400,
              "Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat",
            );
          }
        }
        return runRoute(services.searchAddresses(query.q.trim(), limit, bbox), request);
      },
      {
        beforeHandle: requireApiKey,
        query: searchQuerySchema,
        response: {
          200: toOpenApiSchema(
            addressListSchema.pipe(Schema.annotate({ description: "Matching address records" })),
          ),
          400: toOpenApiSchema(errorSchema),
          401: toOpenApiSchema(errorSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Full-text search addresses",
          description:
            "Search addresses with full-text search: abbreviation expansion (e.g. st → street, rd → road), fuzzy matching fallback for typos, and an optional bounding box filter.",
          tags: ["address"],
        },
      },
    )
    .get(
      "/v1/reverse",
      async ({ query, request }) => {
        const services = await getServices(request);
        const lat = Number(query.lat);
        const lng = Number(query.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return toErrorResponse(
            400,
            "Invalid coordinates. Expected lat and lng in decimal degrees",
          );
        }
        const limit = parseLimit(query.limit, 10, 100);
        return runRoute(services.reverseGeocode(lng, lat, limit), request);
      },
      {
        beforeHandle: requireApiKey,
        query: reverseQuerySchema,
        response: {
          200: toOpenApiSchema(
            addressListSchema.pipe(Schema.annotate({ description: "Nearest address records" })),
          ),
          400: toOpenApiSchema(errorSchema),
          401: toOpenApiSchema(errorSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Reverse geocode",
          description:
            "Find the nearest addresses to given geographic coordinates, sorted by distance.",
          tags: ["address"],
        },
      },
    )
    .get(
      "/v1/meta",
      async ({ request }) => {
        const services = await getServices(request);
        return runRoute(services.getMeta(), request);
      },
      {
        beforeHandle: requireApiKey,
        response: {
          200: toOpenApiSchema(
            metaSchema.pipe(Schema.annotate({ description: "Dataset metadata" })),
          ),
          401: toOpenApiSchema(errorSchema),
          500: toOpenApiSchema(errorSchema),
        },
        detail: {
          summary: "Dataset metadata",
          description:
            "Returns metadata about the LINZ NZ Addresses dataset: version, total record count, and last ingestion timestamp.",
          tags: ["address"],
        },
      },
    );
};

export const addressRoutes = createAddressRoutes(addressServicesFromRequest);

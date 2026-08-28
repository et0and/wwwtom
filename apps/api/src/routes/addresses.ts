import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpError } from "@tom/types/errors";
import { errorResponseSchema } from "@tom/schemas/error";
import { logContextFromRequest, runEffect, toErrorResponse } from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
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

const errorSchema = errorResponseSchema;

const parseLimit = (raw: string | undefined, fallback: number, max: number): number => {
  const value = parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, max) : fallback;
};

const parseBbox = (value: string): readonly [number, number, number, number] => {
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("bbox must have 4 comma-separated values");
  }
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  return [minLng, minLat, maxLng, maxLat];
};

const BboxParamSchema = Schema.String.pipe(
  Schema.annotate({
    description: "Bounding box filter as minLng,minLat,maxLng,maxLat",
    examples: ["174.77,-41.29,174.79,-41.28"],
  }),
);

const SearchQuerySchema = Schema.Struct({
  q: Schema.String.pipe(
    Schema.annotate({
      description: "Search query string (min 3 chars)",
      examples: ["lambton quay"],
    }),
  ),
  bbox: Schema.optional(BboxParamSchema),
  limit: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Maximum results (default: 100, max: 1000)" }),
  ),
});

const searchQuerySchema = toOpenApiSchema(SearchQuerySchema);

const ReverseQuerySchema = Schema.Struct({
  lat: Schema.String.pipe(
    Schema.annotate({ description: "Latitude in decimal degrees", examples: ["-41.2865"] }),
  ),
  lng: Schema.String.pipe(
    Schema.annotate({ description: "Longitude in decimal degrees", examples: ["174.7762"] }),
  ),
  limit: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Maximum results (default: 10, max: 100)" }),
  ),
});

const reverseQuerySchema = toOpenApiSchema(ReverseQuerySchema);

const ListQuerySchema = Schema.Struct({
  limit: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Maximum results (default: 100, max: 1000)" }),
  ),
  offset: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Number of results to skip" }),
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
  bbox: Schema.optional(BboxParamSchema),
});

const listQuerySchema = toOpenApiSchema(ListQuerySchema);

const ParamsSchema = Schema.Struct({ id: Schema.String });

export const addressRoutes = new Elysia({ name: "address" })
  .get(
    "/v1/search",
    async ({ query, request, set }) => {
      const decoded = Schema.decodeUnknownSync(SearchQuerySchema)(query);
      const trimmed = decoded.q.trim();
      if (trimmed.length < 3) {
        set.status = 400;
        return toErrorResponse(400, "Query must be at least 3 characters");
      }

      const limit = parseLimit(decoded.limit, 100, 1000);

      let bbox: readonly [number, number, number, number] | undefined;
      const bboxValue = decoded.bbox;
      if (bboxValue) {
        try {
          bbox = parseBbox(bboxValue);
        } catch {
          set.status = 400;
          return toErrorResponse(400, "Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat");
        }
      }

      set.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60";

      const services = await addressServicesFromRequest(request);
      const effect = services
        .searchAddresses(trimmed, limit, bbox)
        .pipe(
          Effect.catch((error: HttpError) =>
            Effect.succeed(toErrorResponse(error.status, error.message)),
          ),
        );

      const result = await runEffect(effect, logContextFromRequest(request, "tom-api"));
      if (result instanceof Response) return result;
      return result;
    },
    {
      query: searchQuerySchema,
      response: {
        200: toOpenApiSchema(addressListSchema),
        400: toOpenApiSchema(errorSchema),
        500: toOpenApiSchema(errorSchema),
      },
      detail: {
        summary: "Full-text search addresses (tsvector)",
        description:
          "Search NZ addresses via Postgres tsvector/GIN with tsquery, alias expansion, and typo correction. Reads hit the Neon read replica. Query must be ≥3 chars; debounce 250ms on client.",
        tags: ["address"],
      },
    },
  )
  .get(
    "/v1/addresses/:id",
    async ({ params, request, set }) => {
      const decoded = Schema.decodeUnknownSync(ParamsSchema)(params);
      const id = Number(decoded.id);
      if (!Number.isFinite(id)) {
        set.status = 400;
        return toErrorResponse(400, "Invalid address id");
      }
      const services = await addressServicesFromRequest(request);
      const effect = services.getAddressById(id).pipe(
        Effect.flatMap((row) => {
          if (!row)
            return Effect.fail(new HttpError({ message: "Address not found", status: 404 }));
          return Effect.succeed(row);
        }),
        Effect.catch((error: HttpError) =>
          Effect.succeed(toErrorResponse(error.status, error.message)),
        ),
      );
      const result = await runEffect(effect, logContextFromRequest(request, "tom-api"));
      if (result instanceof Response) return result;
      return result;
    },
    {
      response: {
        200: toOpenApiSchema(addressSchema),
        400: toOpenApiSchema(errorSchema),
        404: toOpenApiSchema(errorSchema),
        500: toOpenApiSchema(errorSchema),
      },
      detail: {
        summary: "Get address by ID",
        description: "Retrieve a single NZ address by LINZ address_id. Reads hit the Neon replica.",
        tags: ["address"],
      },
    },
  )
  .get(
    "/v1/addresses",
    async ({ query, request }) => {
      const decoded = Schema.decodeUnknownSync(ListQuerySchema)(query);
      const limit = parseLimit(decoded.limit, 100, 1000);
      const offset = parseLimit(decoded.offset, 0, 1_000_000);
      const bboxValue = decoded.bbox;
      let bbox: readonly [number, number, number, number] | undefined;
      if (bboxValue) {
        try {
          bbox = parseBbox(bboxValue);
        } catch {
          return toErrorResponse(400, "Invalid bbox format");
        }
      }

      let filters: import("@tom/types/address").AddressFilters = { limit, offset };
      if (decoded.town_city !== undefined) filters = { ...filters, townCity: decoded.town_city };
      if (decoded.suburb_locality !== undefined)
        filters = { ...filters, suburbLocality: decoded.suburb_locality };
      if (decoded.road_name !== undefined) filters = { ...filters, roadName: decoded.road_name };
      if (bbox !== undefined) filters = { ...filters, bbox };

      const services = await addressServicesFromRequest(request);
      const effect = services
        .listAddresses(filters)
        .pipe(
          Effect.catch((error: HttpError) =>
            Effect.succeed(toErrorResponse(error.status, error.message)),
          ),
        );
      const result = await runEffect(effect, logContextFromRequest(request, "tom-api"));
      if (result instanceof Response) return result;
      return result;
    },
    {
      query: listQuerySchema,
      response: {
        200: toOpenApiSchema(addressListSchema),
        400: toOpenApiSchema(errorSchema),
        500: toOpenApiSchema(errorSchema),
      },
      detail: {
        summary: "List addresses with filters",
        description:
          "Paginated list with optional town/city, suburb, road, bbox filters. Reads hit replica.",
        tags: ["address"],
      },
    },
  )
  .get(
    "/v1/reverse",
    async ({ query, request, set }) => {
      const decoded = Schema.decodeUnknownSync(ReverseQuerySchema)(query);
      const lat = Number(decoded.lat);
      const lng = Number(decoded.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        set.status = 400;
        return toErrorResponse(400, "lat and lng are required numbers");
      }
      const limit = parseLimit(decoded.limit, 10, 100);
      const services = await addressServicesFromRequest(request);
      const effect = services
        .reverseGeocode(lng, lat, limit)
        .pipe(
          Effect.catch((error: HttpError) =>
            Effect.succeed(toErrorResponse(error.status, error.message)),
          ),
        );
      const result = await runEffect(effect, logContextFromRequest(request, "tom-api"));
      if (result instanceof Response) return result;
      return result;
    },
    {
      query: reverseQuerySchema,
      response: {
        200: toOpenApiSchema(addressListSchema),
        400: toOpenApiSchema(errorSchema),
        500: toOpenApiSchema(errorSchema),
      },
      detail: {
        summary: "Reverse geocode",
        description: "Nearest addresses by lng/lat distance. Reads hit replica.",
        tags: ["address"],
      },
    },
  )
  .get(
    "/v1/meta",
    async ({ request }) => {
      const services = await addressServicesFromRequest(request);
      const effect = services
        .getMeta()
        .pipe(
          Effect.catch((error: HttpError) =>
            Effect.succeed(toErrorResponse(error.status, error.message)),
          ),
        );
      const result = await runEffect(effect, logContextFromRequest(request, "tom-api"));
      if (result instanceof Response) return result;
      return result;
    },
    {
      response: {
        200: toOpenApiSchema(metaSchema),
        500: toOpenApiSchema(errorSchema),
      },
      detail: {
        summary: "Dataset metadata",
        description: "Version, total count, last updated. Reads hit replica.",
        tags: ["address"],
      },
    },
  );

import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { readCloudflareEnv } from "@tom/utils/services/config";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv } from "@tom/utils/services/worker";
import { makeAddressDb, type AddressDbService } from "./db";
import { getAddressById, listAddresses, reverseGeocode, getMeta } from "./addresses";
import type { Address, AddressFilters, Bbox, Meta } from "./addresses";
import { makeSearchService } from "./search";
import { hashApiKey, generateApiKey } from "./auth";
import { generateChallengeData, validateProof, proofError } from "./proof";
import { makeAbuseService, type AbuseService } from "./abuse";
import { makeRateLimiter, type RateLimiterService } from "./rate-limiter";
import { startIngestion, ingestRun } from "./ingest";
import type { IngestStart } from "./ingest";

export interface AuthResult {
  readonly allowed: boolean;
  readonly status?: number;
  readonly message?: string;
  readonly retryAfter?: number;
}

export interface Challenge {
  readonly challenge: string;
  readonly token: string;
  readonly difficulty: number;
  readonly expiresAt: number;
}

export interface KeyResponse {
  readonly apiKey: string;
  readonly rateLimit: number;
}

export interface AddressServices {
  readonly getAddressById: (id: number) => Effect.Effect<Address | null, HttpError>;
  readonly listAddresses: (filters: AddressFilters) => Effect.Effect<readonly Address[], HttpError>;
  readonly searchAddresses: (
    query: string,
    limit: number,
    bbox?: Bbox,
  ) => Effect.Effect<readonly Address[], HttpError>;
  readonly reverseGeocode: (
    lng: number,
    lat: number,
    limit: number,
  ) => Effect.Effect<readonly Address[], HttpError>;
  readonly getMeta: () => Effect.Effect<Meta, HttpError>;
  readonly getChallenge: () => Effect.Effect<Challenge, HttpError>;
  readonly requestApiKey: (
    challenge: string,
    nonce: number,
    token: string,
  ) => Effect.Effect<KeyResponse, HttpError>;
  readonly startIngestion: () => Effect.Effect<IngestStart, HttpError>;
  readonly ingestRun: (
    runId: string,
    version: string,
    total: number,
  ) => Effect.Effect<void, HttpError>;
  readonly authenticateApiKey: (
    apiKey: string | undefined,
    ip: string,
  ) => Effect.Effect<AuthResult, HttpError>;
  readonly authenticateAdmin: (
    adminKey: string | undefined,
  ) => Effect.Effect<AuthResult, HttpError>;
}

export const makeAddressServices = (env: CloudflareEnv): AddressServices => {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.ADDRESS_DB ?? "";
  const db: AddressDbService = makeAddressDb(connectionString);
  const kv = env.TOM_RATE_LIMIT_KV;
  const abuse: AbuseService = makeAbuseService(kv);
  const rateLimiter: RateLimiterService = makeRateLimiter(kv);
  const search = makeSearchService(db);
  const apiKeySalt = env.ADDRESS_API_KEY_SALT ?? "";

  return {
    getAddressById: (id) => getAddressById(db, id),

    listAddresses: (filters) => listAddresses(db, filters),

    searchAddresses: (query, limit, bbox) =>
      search.search(query, limit).pipe(
        Effect.map((results) => {
          if (!bbox) return results;
          const [minLng, minLat, maxLng, maxLat] = bbox;
          return results.filter(
            (row) =>
              row.longitude >= minLng &&
              row.longitude <= maxLng &&
              row.latitude >= minLat &&
              row.latitude <= maxLat,
          );
        }),
      ),

    reverseGeocode: (lng, lat, limit) => reverseGeocode(db, lng, lat, limit),

    getMeta: () => getMeta(db),

    getChallenge: () =>
      Effect.gen(function* () {
        const { challengeId, token, difficulty, expiresAt } = generateChallengeData(4);
        yield* abuse.saveChallenge(challengeId, difficulty);
        return { challenge: challengeId, token, difficulty, expiresAt };
      }),

    requestApiKey: (challenge, nonce, token) =>
      Effect.gen(function* () {
        const isReplay = yield* abuse.isPowReplay(token);
        if (isReplay) {
          return yield* proofError("Proof already used");
        }

        const difficulty = yield* abuse.getChallengeDifficulty(challenge);
        if (difficulty === null) {
          return yield* proofError("Proof expired");
        }

        yield* validateProof(nonce, token, difficulty);
        yield* abuse.markPowUsed(token);

        const newKey = generateApiKey();
        const keyHash = yield* Effect.tryPromise({
          try: () => hashApiKey(newKey, apiKeySalt),
          catch: () => proofError("Invalid proof"),
        });
        yield* db.insertApiKey(keyHash);

        return { apiKey: newKey, rateLimit: 60 };
      }),

    startIngestion: () => startIngestion(env.ADDRESS_LINZ_API_KEY, db),

    ingestRun: (runId, version, total) =>
      ingestRun(env.ADDRESS_LINZ_API_KEY, db, runId, version, total),

    authenticateApiKey: (apiKey, ip) =>
      Effect.gen(function* () {
        if (!apiKey) {
          return { allowed: false, status: 401, message: "Missing API key" };
        }

        const banned = yield* abuse.isBanned(ip);
        if (banned) {
          return { allowed: false, status: 403, message: "Forbidden" };
        }

        const hashedKey = yield* Effect.tryPromise({
          try: () => hashApiKey(apiKey, apiKeySalt),
          catch: () => new HttpError({ message: "Invalid API key", status: 401 }),
        });

        const valid = yield* db.hasApiKey(hashedKey);
        if (!valid) {
          return { allowed: false, status: 401, message: "Invalid API key" };
        }

        const limit = yield* rateLimiter.checkLimit(hashedKey);
        if (!limit.allowed) {
          yield* abuse.recordStrike(ip);
          const result: AuthResult = {
            allowed: false,
            status: 429,
            message: "Rate limit exceeded",
          };
          return limit.retryAfter === undefined
            ? result
            : { ...result, retryAfter: limit.retryAfter };
        }

        return { allowed: true };
      }),

    authenticateAdmin: (adminKey) =>
      Effect.succeed(
        adminKey && env.ADDRESS_ADMIN_KEY !== undefined && adminKey === env.ADDRESS_ADMIN_KEY
          ? { allowed: true }
          : {
              allowed: false,
              status: 403,
              message: adminKey ? "Invalid admin key" : "Missing admin key",
            },
      ),
  };
};

let cached: { key: string; services: AddressServices } | undefined;

export const addressServicesFromRequest = async (request: Request): Promise<AddressServices> => {
  const env = await readCloudflareEnv(getRequestEnv(request));
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.ADDRESS_DB ?? "";
  const key = `${connectionString}:${env.ADDRESS_API_KEY_SALT ?? ""}:${env.ADDRESS_ADMIN_KEY ?? ""}`;
  if (cached && cached.key === key) return cached.services;

  const services = makeAddressServices(env);
  cached = { key, services };
  return services;
};

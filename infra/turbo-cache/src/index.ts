import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { TurboCacheError } from "@tom/types/errors";
import { logLevelFromEnv, otelConfigFromResolvedEnv } from "@tom/utils/services/logging";
import { readCloudflareEnv, type CloudflareEnv } from "@tom/utils/services/config";
import {
  attachRequestContext,
  logContextFromRequest,
  runEffect,
  sendErrorAlert,
  toErrorMessage,
  toErrorResponse,
} from "@tom/utils/services/worker";

/**
 * Turborepo remote cache server backed by Cloudflare KV.
 *
 * Implements the `turborepo-remote-cache` HTTP contract used by the Turbo CLI
 * (see `turborepo-cache` / `turborepo-api-client` client code):
 * - `PUT /v8/artifacts/{hash}` uploads an artifact (gzip-compressed tarball)
 * - `GET /v8/artifacts/{hash}` downloads one (404 = cache miss)
 * - `HEAD /v8/artifacts/{hash}` checks existence
 * - `GET /v8/artifacts/status` reports caching as enabled
 * - `POST /v8/artifacts/events` accepts (and discards) usage analytics
 *
 * All routes require `Authorization: Bearer <TURBO_CACHE_TOKEN>`.
 */

// Cloudflare KV rejects values over 25 MiB, so artifacts are capped up front
// to fail with a clear 413 instead of a mid-flight KV error.
export const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
// Artifacts expire so stale branch caches do not accumulate forever.
export const ARTIFACT_TTL_SECONDS = 7 * 24 * 60 * 60;

// Turbo artifact hashes are URL-safe opaque strings (usually 64-char hex).
// The range also caps the KV key at the platform's 512-byte limit.
const ARTIFACT_ROUTE_PATTERN = /^\/v8\/artifacts\/([A-Za-z0-9._~-]{8,512})$/;

export type ArtifactMetadata = {
  readonly duration?: number;
  readonly tag?: string;
  readonly sha?: string;
  readonly dirtyHash?: string;
};

/**
 * The KV surface this worker relies on. Kept narrow so the handler stays
 * testable without faking the entire KVNamespace interface; Cloudflare's
 * KVNamespace binding satisfies it structurally.
 */
type TurboCacheKv = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { expirationTtl?: number; metadata?: ArtifactMetadata },
  ): Promise<void>;
  getWithMetadata(
    key: string,
    type: "arrayBuffer",
  ): Promise<{ value: ArrayBuffer | null; metadata: ArtifactMetadata | null }>;
};

export type TurboCacheEnv = CloudflareEnv & {
  readonly TURBO_CACHE_KV: TurboCacheKv;
  // Resolved from the TOM_SECRETS bundle by readCloudflareEnv.
  readonly TURBO_CACHE_TOKEN?: string;
};

const TurboCacheSecrets = Schema.Struct({
  TURBO_CACHE_TOKEN: Schema.String.check(Schema.isMinLength(32)),
});

type TurboCacheSecrets = Schema.Schema.Type<typeof TurboCacheSecrets>;

const parseTurboCacheSecrets = (
  env: CloudflareEnv,
): Effect.Effect<TurboCacheSecrets, TurboCacheError> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(TurboCacheSecrets)(env),
    catch: (cause) => new TurboCacheError({ message: "Turbo cache secrets are invalid", cause }),
  });

/**
 * Constant-time byte comparison of two same-length buffers (WebCrypto has no
 * timingSafeEqual on Workers).
 */
const constantTimeEqual = (a: ArrayBuffer, b: ArrayBuffer): boolean => {
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
};

const secureEqual = (provided: string, expected: string): Effect.Effect<boolean, TurboCacheError> =>
  Effect.gen(function* () {
    const digest = (value: string) =>
      Effect.tryPromise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    const [providedHash, expectedHash] = yield* Effect.all([
      digest(provided),
      digest(expected),
    ]).pipe(
      Effect.mapError(
        (cause) => new TurboCacheError({ message: "Timing-safe compare failed", cause }),
      ),
    );
    return constantTimeEqual(providedHash, expectedHash);
  });

const authenticate = (
  request: Request,
  expectedToken: string,
): Effect.Effect<boolean, TurboCacheError> => {
  if (expectedToken.length < 32) return Effect.succeed(false);
  const authorization = request.headers.get("Authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  return secureEqual(providedToken, expectedToken);
};

const metadataFromHeaders = (headers: Headers): ArtifactMetadata => {
  const duration = headers.get("x-artifact-duration");
  const parsedDuration = duration === null ? NaN : Number.parseInt(duration, 10);
  const tag = headers.get("x-artifact-tag");
  const sha = headers.get("x-artifact-sha");
  const dirtyHash = headers.get("x-artifact-dirty-hash");
  return {
    ...(Number.isFinite(parsedDuration) && { duration: parsedDuration }),
    ...(tag !== null && { tag }),
    ...(sha !== null && { sha }),
    ...(dirtyHash !== null && { dirtyHash }),
  };
};

const artifactHeaders = (metadata: ArtifactMetadata, contentLength: number): Headers => {
  const headers = new Headers({ "Content-Length": String(contentLength) });
  if (metadata.duration !== undefined) {
    headers.set("x-artifact-duration", String(metadata.duration));
  }
  if (metadata.tag !== undefined) headers.set("x-artifact-tag", metadata.tag);
  if (metadata.sha !== undefined) headers.set("x-artifact-sha", metadata.sha);
  if (metadata.dirtyHash !== undefined) headers.set("x-artifact-dirty-hash", metadata.dirtyHash);
  return headers;
};

const storeArtifact = (
  kv: TurboCacheKv,
  hash: string,
  body: ArrayBuffer,
  metadata: ArtifactMetadata,
): Effect.Effect<void, TurboCacheError> =>
  Effect.tryPromise({
    try: () => kv.put(hash, body, { expirationTtl: ARTIFACT_TTL_SECONDS, metadata }),
    catch: (cause) => new TurboCacheError({ message: "Failed to store cache artifact", cause }),
  });

const loadArtifact = (
  kv: TurboCacheKv,
  hash: string,
): Effect.Effect<
  { body: ArrayBuffer; metadata: ArtifactMetadata | null } | null,
  TurboCacheError
> =>
  Effect.tryPromise({
    try: async () => {
      const entry = await kv.getWithMetadata(hash, "arrayBuffer");
      if (entry.value === null) return null;
      return { body: entry.value, metadata: entry.metadata };
    },
    catch: (cause) => new TurboCacheError({ message: "Failed to read cache artifact", cause }),
  });

const putArtifact = (
  request: Request,
  hash: string,
  kv: TurboCacheKv,
): Effect.Effect<Response, TurboCacheError> =>
  Effect.gen(function* () {
    const contentLength = request.headers.get("Content-Length");
    if (contentLength !== null && Number.parseInt(contentLength, 10) > MAX_ARTIFACT_BYTES) {
      return toErrorResponse(
        HttpStatus.PayloadTooLarge,
        "Artifact exceeds the 25 MiB Cloudflare KV value limit",
      );
    }

    const body = yield* Effect.tryPromise({
      try: () => request.arrayBuffer(),
      catch: (cause) => new TurboCacheError({ message: "Failed to read artifact body", cause }),
    });
    if (body.byteLength > MAX_ARTIFACT_BYTES) {
      return toErrorResponse(
        HttpStatus.PayloadTooLarge,
        "Artifact exceeds the 25 MiB Cloudflare KV value limit",
      );
    }

    yield* storeArtifact(kv, hash, body, metadataFromHeaders(request.headers));
    yield* Effect.logInfo("cache artifact stored", { hash, bytes: body.byteLength });
    return new Response(null, { status: HttpStatus.Ok });
  });

const getArtifact = (hash: string, kv: TurboCacheKv): Effect.Effect<Response, TurboCacheError> =>
  Effect.gen(function* () {
    const entry = yield* loadArtifact(kv, hash);
    if (entry === null) {
      yield* Effect.logDebug("cache artifact miss", { hash });
      return toErrorResponse(HttpStatus.NotFound, "Artifact not found");
    }
    yield* Effect.logDebug("cache artifact hit", { hash });
    return new Response(entry.body, {
      status: HttpStatus.Ok,
      headers: artifactHeaders(entry.metadata ?? {}, entry.body.byteLength),
    });
  });

const headArtifact = (hash: string, kv: TurboCacheKv): Effect.Effect<Response, TurboCacheError> =>
  Effect.gen(function* () {
    const entry = yield* loadArtifact(kv, hash);
    if (entry === null) return toErrorResponse(HttpStatus.NotFound, "Artifact not found");
    return new Response(null, {
      status: HttpStatus.Ok,
      headers: artifactHeaders(entry.metadata ?? {}, entry.body.byteLength),
    });
  });

const handleRequest = (
  request: Request,
  env: TurboCacheEnv,
  secrets: TurboCacheSecrets,
): Effect.Effect<Response, TurboCacheError> =>
  Effect.gen(function* () {
    const url = yield* Effect.try({
      // Effect.try is the Effect-idiomatic try/catch; request.url is platform-valid.
      try: () => new URL(request.url), // pi-lens-ignore: unchecked-throwing-call
      catch: (cause) => new TurboCacheError({ message: "Invalid request URL", cause }),
    });

    const authorized = yield* authenticate(request, secrets.TURBO_CACHE_TOKEN);
    if (!authorized) return toErrorResponse(HttpStatus.Unauthorized, "Unauthorized");

    if (request.method === "GET" && url.pathname === "/v8/artifacts/status") {
      return Response.json({ status: "enabled" });
    }
    if (request.method === "POST" && url.pathname === "/v8/artifacts/events") {
      return new Response(null, { status: HttpStatus.Ok });
    }

    const artifactMatch = url.pathname.match(ARTIFACT_ROUTE_PATTERN);
    if (artifactMatch === null || artifactMatch[1] === undefined) {
      return toErrorResponse(HttpStatus.NotFound, "Not found");
    }
    const hash = artifactMatch[1];

    if (request.method === "PUT") return yield* putArtifact(request, hash, env.TURBO_CACHE_KV);
    if (request.method === "GET") return yield* getArtifact(hash, env.TURBO_CACHE_KV);
    if (request.method === "HEAD") return yield* headArtifact(hash, env.TURBO_CACHE_KV);

    return toErrorResponse(HttpStatus.MethodNotAllowed, "Method not allowed");
  });

const handleRequestWithAlerts = (
  request: Request,
  env: TurboCacheEnv,
): Effect.Effect<Response, never> =>
  parseTurboCacheSecrets(env).pipe(
    Effect.flatMap((secrets) => handleRequest(request, env, secrets)),
    Effect.catch((cause) =>
      Effect.gen(function* () {
        yield* Effect.logError("unhandled turbo-cache error", {
          error: toErrorMessage(cause),
        });
        yield* Effect.sync(() => {
          sendErrorAlert(env, "Unhandled turbo-cache error", cause);
        });
        return toErrorResponse(HttpStatus.InternalServerError, "Internal server error");
      }),
    ),
  );

const worker = {
  fetch: async (request: Request, rawEnv: TurboCacheEnv): Promise<Response> => {
    // Resolve the TOM_SECRETS bundle into plain env vars (TURBO_CACHE_TOKEN,
    // telegram alert vars) before anything else. The spread preserves the KV
    // binding and the plain vars.
    const resolvedEnv = await readCloudflareEnv(rawEnv);
    const env = resolvedEnv as TurboCacheEnv;

    const requestId = crypto.randomUUID();
    const otel = otelConfigFromResolvedEnv(resolvedEnv);
    attachRequestContext(request, {
      requestId,
      logLevel: logLevelFromEnv(env),
      ...(otel && { otel }),
    });

    return runEffect(
      handleRequestWithAlerts(request, env),
      logContextFromRequest(request, "wwwtom-turbo-cache"),
    );
  },
};

export default worker;

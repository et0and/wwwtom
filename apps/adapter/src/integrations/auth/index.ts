import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { HttpStatus } from "@tom/constants/http";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import { AdapterError, runAdapter } from "../../config/effect";
import { allowLocalOriginsForAdapter, isTrustedWriteOrigin, tenantFromValue } from "../../origins";
import type { Tenant } from "../../origins";

// Hop-by-hop and framing headers never survive a proxy hop; everything else
// (Set-Cookie, Location, Content-Type) passes through verbatim so the OAuth
// flow and session cookies keep working end to end.
const STRIPPED_HEADERS = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
]);

export const forwardHeaders = (incoming: Headers, token: string | undefined): Headers => {
  const headers = new Headers(incoming);
  if (token) headers.set(INTERNAL_TOKEN_HEADER, token);
  return headers;
};

/** Forward an upstream response verbatim minus hop-by-hop framing headers. */
export const toProxiedResponse = (upstream: Response): Response => {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_HEADERS.has(key.toLowerCase())) headers.append(key, value);
  });
  return new Response(upstream.body, { status: upstream.status, headers });
};

/**
 * Transparent proxy to the API auth endpoints. Auth payloads are tiny
 * JSON/form posts, so the body is buffered (not streamed) for simplicity;
 * upstream 4xx/5xx responses pass through as-is (auth clients parse Better
 * Auth bodies), only network failure becomes a problem response.
 */
type AuthProxyOptions = {
  readonly adapterOrigin: string;
  readonly allowLocalOrigins: boolean;
  readonly tenant: Tenant | undefined;
};

const refererOrigin = (referer: string): Effect.Effect<string, never> =>
  Effect.try(() => new URL(referer).origin).pipe(Effect.orElseSucceed(() => ""));

/**
 * CSRF gate for auth writes. Mirrors the CMS write gate: session cookies
 * travel cross-site, so the proxy verifies the request came from a trusted
 * page. GET/HEAD stay exempt — the OAuth redirect flow lands on GET
 * callbacks (provider → adapter) with no trustworthy Origin.
 */
const requireTrustedAuthOrigin = (
  request: Request,
  options: AuthProxyOptions,
): Effect.Effect<void, AdapterError> =>
  Effect.gen(function* () {
    if (request.method === "GET" || request.method === "HEAD") return;
    const { adapterOrigin, allowLocalOrigins, tenant } = options;
    const direct = request.headers.get("origin");
    if (direct !== null) {
      return yield* isTrustedWriteOrigin(direct, adapterOrigin, allowLocalOrigins, tenant)
        ? Effect.void
        : Effect.fail(
            new AdapterError({
              status: HttpStatus.Forbidden,
              message: "Untrusted auth origin",
            }),
          );
    }
    const referer = request.headers.get("referer");
    if (referer === null) return;
    const origin = yield* refererOrigin(referer);
    if (!isTrustedWriteOrigin(origin, adapterOrigin, allowLocalOrigins, tenant)) {
      return yield* Effect.fail(
        new AdapterError({
          status: HttpStatus.Forbidden,
          message: "Untrusted auth origin",
        }),
      );
    }
  });

const CallbackBodySchema = Schema.Struct({ callbackURL: Schema.optional(Schema.String) });

/**
 * Origins a sign-in callbackURL may point at: the adapter itself or a
 * trusted tenant web origin. Relative URLs stay same-origin and pass;
 * unparseable bodies pass for the upstream to reject.
 */
const isTrustedCallbackURL = (callbackURL: string, options: AuthProxyOptions): boolean => {
  const url = Schema.decodeUnknownOption(Schema.URLFromString)(callbackURL);
  if (Option.isNone(url)) return true;
  return isTrustedWriteOrigin(
    url.value.origin,
    options.adapterOrigin,
    options.allowLocalOrigins,
    options.tenant,
  );
};

/**
 * Callback gate for sign-in POSTs. Better Auth redirects to callbackURL
 * after login, so an attacker-supplied https://evil.com must never reach
 * the API — reject it here per tenant, before proxying.
 */
const requireTrustedCallbackURL = (
  request: Request,
  body: string | undefined,
  options: AuthProxyOptions,
): Effect.Effect<void, AdapterError> =>
  Effect.gen(function* () {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" || request.method === "HEAD") return;
    if (!path.startsWith("/auth/sign-in/") || body === undefined) return;
    const json = yield* Effect.try(() => JSON.parse(body) as unknown).pipe(
      Effect.orElseSucceed(() => null),
    );
    const parsed = Schema.decodeUnknownOption(CallbackBodySchema)(json);
    if (
      Option.isSome(parsed) &&
      parsed.value.callbackURL !== undefined &&
      !isTrustedCallbackURL(parsed.value.callbackURL, options)
    ) {
      return yield* Effect.fail(
        new AdapterError({
          status: HttpStatus.Forbidden,
          message: "Untrusted auth callback",
        }),
      );
    }
  });

const proxyAuth = (
  request: Request,
  apiUrl: string,
  token: string | undefined,
  options: AuthProxyOptions,
) => {
  const url = new URL(request.url);
  return runAdapter(
    Effect.gen(function* () {
      yield* requireTrustedAuthOrigin(request, options);
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : yield* Effect.tryPromise({
              try: () => request.text(),
              catch: () =>
                new AdapterError({
                  status: HttpStatus.BadRequest,
                  message: "Unreadable auth request",
                }),
            });
      yield* requireTrustedCallbackURL(request, body, options);
      const upstream = yield* Effect.tryPromise({
        try: () =>
          fetch(`${apiUrl}${url.pathname}${url.search}`, {
            method: request.method,
            headers: forwardHeaders(request.headers, token),
            body: body ?? null,
            redirect: "manual",
          }),
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadGateway,
            message: "CMS auth unavailable",
          }),
      });
      return toProxiedResponse(upstream);
    }),
    (error) => error,
    logContextFromRequest(request, "tom-adapter"),
  );
};

export const authIntegration = new Elysia({ name: "auth" }).all(
  "/auth/*",
  async ({ request }) => {
    const env = await readCloudflareEnv(getRequestEnv(request));
    return proxyAuth(request, env.API_URL ?? "http://localhost:8787", env.INTERNAL_API_TOKEN, {
      adapterOrigin: env.ADAPTER_URL ?? "http://localhost:8788",
      allowLocalOrigins: allowLocalOriginsForAdapter(env.ADAPTER_URL),
      tenant: tenantFromValue(env.TENANT),
    });
  },
  {
    detail: { description: "CMS auth proxy to the Tom API", tags: ["cms"] },
  },
);

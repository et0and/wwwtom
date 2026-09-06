import { Elysia } from "elysia";
import { Effect } from "effect";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { HttpStatus } from "@tom/constants/http";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import { AdapterError, runAdapter } from "../../config/effect";

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
const proxyAuth = (request: Request, apiUrl: string, token: string | undefined) => {
  const url = new URL(request.url);
  return runAdapter(
    Effect.gen(function* () {
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
    return proxyAuth(request, env.API_URL ?? "http://localhost:8787", env.INTERNAL_API_TOKEN);
  },
  {
    detail: { description: "CMS auth proxy to the Tom API", tags: ["cms"] },
  },
);

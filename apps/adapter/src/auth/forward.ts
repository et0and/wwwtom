import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

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
export const toProxiedResponse = (upstream: Response): Response =>
  new Response(upstream.body, {
    status: upstream.status,
    headers: new Headers(
      Array.from(upstream.headers).filter(([key]) => !STRIPPED_HEADERS.has(key.toLowerCase())),
    ),
  });

/**
 * Session credentials a proxied read must carry. `hasSessionCredential`
 * treats a session cookie and a Bearer token as private reads, so both reach
 * the api and its cache policy stays honest.
 */
export const sessionHeaders = (request: Request) =>
  Object.fromEntries(
    ["cookie", "authorization"].flatMap((name) => {
      const value = request.headers.get(name);
      return value === null ? [] : [[name, value] as const];
    }),
  );

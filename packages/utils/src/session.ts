import { Cookies } from "effect/http";

/**
 * Shared session-credential gate for CMS reads. Anonymous readers fetch
 * published-only content and their responses are edge-cacheable; a live
 * session unlocks drafts and must never store. The API (skip the auth/D1
 * lookup) and the adapter (cache headers, header forwarding) key off this
 * one check so the two hops cannot drift.
 */

/**
 * better-auth session cookie names (default cookiePrefix). Matched by parsed
 * name, not substring, so OAuth nonce cookies (better-auth.state-*) never
 * count as a session and a cookie value cannot smuggle a match.
 */
const SESSION_COOKIE_NAMES: ReadonlyArray<string> = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

/** A bearer token with a non-empty credential. */
const BEARER_AUTHORIZATION_PATTERN = /^bearer\s+\S+$/i;

/** A request carries a session credential when it can unlock drafts. */
export const hasSessionCredential = (request: Request): boolean => {
  const cookie = request.headers.get("cookie");
  if (cookie !== null) {
    const parsed = Cookies.parseHeader(cookie);
    if (SESSION_COOKIE_NAMES.some((name) => Object.hasOwn(parsed, name))) return true;
  }
  const authorization = request.headers.get("authorization");
  return authorization !== null && BEARER_AUTHORIZATION_PATTERN.test(authorization);
};

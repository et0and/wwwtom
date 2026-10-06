/**
 * Shared session-credential gate for CMS reads. Anonymous readers fetch
 * published-only content and their responses are edge-cacheable; a live
 * session unlocks drafts and must never store. The API (skip the auth/D1
 * lookup) and the adapter (cache headers, header forwarding) key off this
 * one check so the two hops cannot drift.
 */

/**
 * better-auth session cookie names (default cookiePrefix). Matched by name,
 * not substring, so OAuth nonce cookies (better-auth.state-*) never count
 * as a session. Reads the name before `=` so cookie values cannot smuggle
 * a match.
 */
const SESSION_COOKIE_PATTERN =
  /(?:^|;\s*)(?:__Secure-)?better-auth\.(?:session_token|session_data)=/;

/** A request carries a session credential when it can unlock drafts. */
export const hasSessionCredential = (request: Request): boolean => {
  const cookie = request.headers.get("cookie") ?? "";
  if (SESSION_COOKIE_PATTERN.test(cookie)) return true;
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ");
};

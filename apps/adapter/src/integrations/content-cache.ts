import { hasSessionCredential } from "@tom/utils/services/session";

/**
 * Edge TTLs for anonymous content reads: a minute fresh at the edge, five in
 * a shared cache, a day of stale-while-revalidate. Content edits are rare and
 * readers tolerate slight staleness; session reads (drafts) never store.
 */
const PUBLIC_CONTENT_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";
const PRIVATE_NO_STORE = "private, no-store";

/**
 * Edge-cache public content reads. Anonymous responses are identical for every
 * reader (published only), so they cache at the edge with
 * stale-while-revalidate; session requests carry drafts and never store.
 * Only anonymous responses ever populate the cache, so an admin preview
 * may read stale-published but an anonymous reader can never see drafts.
 * Called only after a successful read — error responses never store.
 */
export const setPublicContentCache = (
  request: Request,
  set: { headers: Record<string, string | number> },
): void => {
  if (hasSessionCredential(request)) {
    set.headers["Cache-Control"] = PRIVATE_NO_STORE;
    return;
  }
  set.headers["Cache-Control"] = PUBLIC_CONTENT_CACHE;
  set.headers["CDN-Cache-Control"] = PUBLIC_CONTENT_CACHE;
};

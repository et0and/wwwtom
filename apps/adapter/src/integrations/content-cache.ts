import { hasSessionCredential } from "@tom/utils/services/session";
import { PUBLIC_CONTENT_CACHE_CONTROL } from "@tom/constants/cache";

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
  set.headers["Cache-Control"] = PUBLIC_CONTENT_CACHE_CONTROL;
  set.headers["CDN-Cache-Control"] = PUBLIC_CONTENT_CACHE_CONTROL;
};

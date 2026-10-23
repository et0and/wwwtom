/**
 * Edge cache headers for public HTML pages (posts, work): a minute fresh
 * in the browser, an hour in shared caches, a day of stale-while-revalidate.
 */
export const PUBLIC_PAGE_CACHE_CONTROL =
  "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400";
export const PUBLIC_PAGE_CDN_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

/**
 * Edge cache headers for public JSON content reads (adapter): a minute
 * fresh, an hour in shared caches, a day of stale-while-revalidate.
 */
export const PUBLIC_CONTENT_CACHE_CONTROL =
  "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

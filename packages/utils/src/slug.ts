/**
 * Turn a human title into a URL slug: NFKD-normalise, fold diacritics (so
 * "Pōneke" becomes "poneke"), lowercase, then collapse every run of
 * non-alphanumerics into a single dash and trim the ends.
 *
 * This returns the raw string rather than a validated slug on purpose. The
 * caller owns the target schema — `CmsSlug` also enforces a character pattern
 * and a 100-character cap, `ArenaSlug` does not — so validation belongs at
 * the point that knows which contract applies. A title that slugifies to
 * nothing (emoji-only) returns an empty string for the caller to handle.
 */
export const toSlug = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

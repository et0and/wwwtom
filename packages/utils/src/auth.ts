/**
 * Admin allowlist check (case-insensitive, whitespace-tolerant).
 *
 * Normalises with a short-circuiting `some` rather than building a normalised
 * copy of the allowlist: this runs on every authenticated CMS request, and the
 * allowlist is only a handful of entries but the copy is pure waste.
 */
export const isAdminEmail = (email: string, allowlist: ReadonlyArray<string>): boolean => {
  const candidate = email.trim().toLowerCase();
  if (candidate.length === 0) return false;
  return allowlist.some((entry) => entry.trim().toLowerCase() === candidate);
};

/**
 * Trusted web origins for credentialed CORS and the CMS write gate.
 * Production and stage hosts follow `<stage-><service>.tom.so` (apex for
 * web in production; see infra/shared.run.ts stageHost). PR numbers make
 * static enumeration impossible, so stage hosts match a constrained
 * pattern over known service labels — never an open `.tom.so` suffix,
 * which would trust every current and future subdomain.
 */

const LOCAL_ORIGINS: ReadonlySet<string> = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const TOM_HOST_PATTERN =
  /^(?:tom\.so|(?:cms|adapter|api|web)\.tom\.so|(?:dev|staging|pr-\d+)-(?:cms|adapter|api|web)\.tom\.so)$/;

const ORIGIN_PATTERN = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/;

/** Exact-match origin check. Local dev origins pass only off production. */
export const isTrustedWebOrigin = (origin: string, allowLocalOrigins: boolean): boolean => {
  if (LOCAL_ORIGINS.has(origin)) return allowLocalOrigins;
  if (!ORIGIN_PATTERN.test(origin)) return false;
  const hostname = origin.slice("https://".length).toLowerCase().split(":")[0] ?? "";
  return TOM_HOST_PATTERN.test(hostname);
};

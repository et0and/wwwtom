/**
 * Trusted web origins for credentialed CORS and the CMS write gate.
 * Production and stage hosts follow `<stage-><service>.tom.so` (apex for
 * web in production; see infra/shared.run.ts stageHost). PR numbers make
 * static enumeration impossible, so stage hosts match a constrained
 * pattern over known service labels — never an open `.tom.so` suffix,
 * which would trust every current and future subdomain.
 *
 * Hosts parse via Effect Schema (`Schema.URLFromString`) and match by
 * exact label lists. No host regex lives here: regexes hide open suffixes
 * and invite ReDoS. Unknown shapes fail closed.
 */

import { Option, Schema } from "effect";

const LOCAL_ORIGINS: ReadonlySet<string> = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5174",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

const TomServiceSchema = Schema.Literals(["cms", "adapter", "api", "web"]);
type TomService = typeof TomServiceSchema.Type;

const SophieServiceSchema = Schema.Literals(["cms", "adapter", "api", "web", "sophie"]);
type SophieService = typeof SophieServiceSchema.Type;

const StageSchema = Schema.Literals(["dev", "staging"]);
type Stage = typeof StageSchema.Type;

const TOM_SERVICES: ReadonlySet<TomService> = new Set(["cms", "adapter", "api", "web"]);

const SOPHIE_SERVICES: ReadonlySet<SophieService> = new Set([
  "cms",
  "adapter",
  "api",
  "web",
  "sophie",
]);

const STAGES: ReadonlySet<Stage> = new Set(["dev", "staging"]);

/** Membership check over a typed allowlist. Lookup takes any label. */
const hasLabel = <T extends string>(allowlist: ReadonlySet<T>, value: string): value is T =>
  (allowlist as ReadonlySet<string>).has(value);

/** Tenant tag selecting which hosts an adapter worker trusts. */
export const TenantSchema = Schema.Literals(["tom", "sophie"]);
export type Tenant = typeof TenantSchema.Type;

/** Tenant tag from worker env. Unknown tags select nothing (shared). */
export const tenantFromValue = (value: string | undefined): Tenant | undefined =>
  value === "tom" || value === "sophie" ? value : undefined;

/**
 * Whether localhost web origins are trusted: true only when the worker
 * itself serves plain http on a loopback host (local workerd, `alchemy
 * dev`, the e2e tsx harness). Deployed workers serve https on a public
 * host, so production never trusts localhost even though the e2e harness
 * runs NODE_ENV=production for cookie parity.
 */
export const allowLocalOriginsForAdapter = (adapterUrl: string | undefined): boolean => {
  if (adapterUrl === undefined || adapterUrl === "") return false;
  const url = Schema.decodeUnknownOption(Schema.URLFromString)(adapterUrl);
  if (Option.isNone(url)) return false;
  if (url.value.protocol !== "http:") return false;
  const hostname = url.value.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
};

const TOM_EXACT_HOSTS: ReadonlySet<string> = new Set([
  "tom.so",
  "cms.tom.so",
  "adapter.tom.so",
  "api.tom.so",
  "web.tom.so",
]);

const SOPHIE_EXACT_HOSTS: ReadonlySet<string> = new Set([
  "sophie.st",
  "www.sophie.st",
  "cms.sophie.st",
  "adapter.sophie.st",
  "api.sophie.st",
]);

/**
 * PR stage numbers arrive as strings (`pr-42`). Positive integers only:
 * NumberFromString alone accepts Infinity and fractions, which never name
 * a real stage.
 */
const PrNumberSchema = Schema.decodeTo(Schema.Int.check(Schema.isGreaterThan(0)))(
  Schema.NumberFromString,
);
const prNumber = (value: string): boolean =>
  Option.isSome(Schema.decodeUnknownOption(PrNumberSchema)(value));

/** `dev-web` / `staging-api` / `pr-42-cms` against a service allowlist. */
const isStagePrefix = (prefix: string, services: ReadonlySet<string>): boolean => {
  const parts = prefix.split("-");
  const head = parts[0];
  if (head === undefined) return false;
  if (hasLabel(STAGES, head)) return parts.length === 2 && hasLabel(services, parts[1] ?? "");
  if (head !== "pr" || parts.length !== 3) return false;
  return prNumber(parts[1] ?? "") && hasLabel(services, parts[2] ?? "");
};

/** Hostname labels without regex: exact hosts plus stage prefixes. */
const isTomHost = (hostname: string): boolean => {
  if (TOM_EXACT_HOSTS.has(hostname)) return true;
  const labels = hostname.split(".");
  if (labels.length !== 3 || labels[1] !== "tom" || labels[2] !== "so") return false;
  const prefix = labels[0];
  if (prefix === undefined) return false;
  return hasLabel(TOM_SERVICES, prefix) || isStagePrefix(prefix, TOM_SERVICES);
};

/** Hostname labels without regex: exact hosts plus stage prefixes. */
const isSophieHost = (hostname: string): boolean => {
  if (SOPHIE_EXACT_HOSTS.has(hostname)) return true;
  const labels = hostname.split(".");
  if (labels.length !== 3 || labels[1] !== "sophie" || labels[2] !== "st") return false;
  const prefix = labels[0];
  if (prefix === undefined) return false;
  return hasLabel(SOPHIE_SERVICES, prefix) || isStagePrefix(prefix, SOPHIE_SERVICES);
};

/**
 * Exact-match origin check. Local dev origins pass only when the worker
 * itself runs on localhost (see allowLocalOriginsForAdapter): gating on
 * NODE_ENV breaks harnesses that run production-like locally, and gating
 * on the request hostname trusts client-controlled input. A tenant tag
 * scopes the check to that tenant's hosts; unset keeps the legacy shared
 * behavior (both tenants).
 */
export const isTrustedWebOrigin = (
  origin: string,
  allowLocalOrigins: boolean,
  tenant: Tenant | undefined,
): boolean => {
  if (LOCAL_ORIGINS.has(origin)) return allowLocalOrigins;
  const url = Schema.decodeUnknownOption(Schema.URLFromString)(origin);
  if (Option.isNone(url)) return false;
  if (url.value.protocol !== "https:") return false;
  const hostname = url.value.hostname.toLowerCase();
  if (tenant === "tom") return isTomHost(hostname);
  if (tenant === "sophie") return isSophieHost(hostname);
  return isTomHost(hostname) || isSophieHost(hostname);
};

/**
 * Origins allowed to drive CMS/auth writes. The adapter itself always
 * passes; web origins must match the tenant-scoped allowlist (exact hosts,
 * so apex tom.so works and unknown subdomains do not). Local editors pass
 * only when the worker itself runs on localhost.
 */
export const isTrustedWriteOrigin = (
  origin: string,
  adapterOrigin: string,
  allowLocalOrigins: boolean,
  tenant: Tenant | undefined,
): boolean => origin === adapterOrigin || isTrustedWebOrigin(origin, allowLocalOrigins, tenant);

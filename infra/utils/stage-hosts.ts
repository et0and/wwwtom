/**
 * Deterministic per-stage hostnames and telemetry policy. Pure — no provider
 * imports — so tooling (the perf harness) can derive stage hosts without
 * loading Alchemy stack modules.
 */

/**
 * Deterministic hostname for a per-stage app subdomain.
 * Production uses the bare subdomain (adapter.tom.so); other stages are
 * prefixed with the stage name (dev-adapter.tom.so).
 */
export const stageHost = (stage: string, sub: string): string =>
  stage === "production" ? `${sub}.tom.so` : `${stage}-${sub}.tom.so`;

/**
 * Hostname for the web app, which is an apex domain in production.
 */
export const stageWebHost = (stage: string): string =>
  stage === "production" ? "tom.so" : `${stage}-web.tom.so`;

/**
 * Deterministic hostname for a per-stage Sophie subdomain.
 * Production uses sophie.st hosts; other stages prefix the stage name.
 */
export const sophieStageHost = (stage: string, sub: string): string =>
  stage === "production" ? `${sub}.sophie.st` : `${stage}-${sub}.sophie.st`;

/**
 * Hostname for the Sophie web app (apex in production).
 */
export const sophieWebHost = (stage: string): string =>
  stage === "production" ? "sophie.st" : `${stage}-sophie.sophie.st`;

/**
 * Stages that ship OTLP telemetry to Axiom. Production always has; staging
 * and per-PR/perf stages join it so the performance harness can read spans
 * for both the candidate and the baseline stage. Other stages stay
 * console-only to keep ingest focused.
 */
export const otelEnabledStages = (stage: string): boolean =>
  stage === "production" ||
  stage === "staging" ||
  stage.startsWith("pr-") ||
  stage.startsWith("perf-");

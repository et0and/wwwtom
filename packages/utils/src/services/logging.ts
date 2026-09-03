import { Effect, Layer, Logger, References, Tracer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import {
  OtlpExporter,
  OtlpLogger,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";
import { readCloudflareEnv, type CloudflareEnv, type ResolvedCloudflareEnv } from "./config";

/**
 * Structured logging standard for Effect code.
 *
 * - Console always writes structured JSON (captured by Workers Logs).
 * - With an AXIOM_TOKEN present, spans and log records export to the OTLP
 *   endpoint (Axiom cloud by default) so requestId/sessionId/userId and
 *   method/path/url annotations and Effect spans are queryable alongside the console
 *   output. The ingest token is an IaC-minted Secrets Store binding in
 *   production (see infra/shared.run.ts); OTEL_ENDPOINT / OTEL_*_DATASET
 *   remain optional overrides.
 * - Levels default to Info; set LOG_LEVEL=Debug for verbose local output.
 */
export type OtelConfig = {
  readonly tracesUrl: string;
  readonly logsUrl: string;
  readonly authorization: string;
  readonly tracesDataset: string;
  readonly logsDataset: string;
};

export type LogContext = {
  readonly serviceName: string;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly method?: string;
  readonly path?: string;
  readonly url?: string;
  readonly logLevel?: "Debug" | "Info";
  readonly otel?: OtelConfig;
};

const parseOtelEndpoint = (raw: string | undefined): string | undefined => {
  const endpoint = raw
    ?.trim()
    .replace(/\/collector\/event$/, "")
    .replace(/\/+$/, "");
  return endpoint ? endpoint : undefined;
};

// Axiom cloud OTLP base. The datasets are the runtime defaults
// (tom-traces / tom-logs), so with just an ingest token the exporters
// target Axiom without any endpoint wiring.
const AXIOM_OTEL_ENDPOINT = "https://api.axiom.co";

export const otelConfigFromResolvedEnv = (env: ResolvedCloudflareEnv): OtelConfig | undefined => {
  const endpoint = parseOtelEndpoint(env.OTEL_ENDPOINT) ?? AXIOM_OTEL_ENDPOINT;
  const token = env.AXIOM_TOKEN?.trim();
  if (!token) return undefined;
  return {
    tracesUrl: `${endpoint}/v1/traces`,
    logsUrl: `${endpoint}/v1/logs`,
    authorization: `Bearer ${token}`,
    tracesDataset: env.OTEL_TRACES_DATASET ?? "tom-traces",
    logsDataset: env.OTEL_LOGS_DATASET ?? "tom-logs",
  };
};

export const otelConfigFromEnv = (env: CloudflareEnv): Promise<OtelConfig | undefined> =>
  readCloudflareEnv(env).then(otelConfigFromResolvedEnv);

export const logLevelFromEnv = (env: CloudflareEnv): "Debug" | "Info" =>
  env.LOG_LEVEL === "Debug" ? "Debug" : "Info";

type LogAnnotations = {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  method?: string;
  path?: string;
  url?: string;
};

const logAnnotations = (context: LogContext): LogAnnotations => ({
  ...(context.requestId && { requestId: context.requestId }),
  ...(context.sessionId && { sessionId: context.sessionId }),
  ...(context.userId && { userId: context.userId }),
  ...(context.method && { method: context.method }),
  ...(context.path && { path: context.path }),
  ...(context.url && { url: context.url }),
});

/**
 * Console + OTLP loggers in a single Logger layer (a logger array composes
 * them) plus the OTLP tracer. Built per request so the layer scope closes with
 * the effect, flushing spans/log records before the response. Console-only
 * when no OTEL config is present.
 */
const makeLoggingLayer = (context: LogContext) => {
  const otel = context.otel;
  if (!otel) return Logger.layer([Logger.consoleStructured]);
  const resource = {
    serviceName: context.serviceName,
    attributes: { app: context.serviceName },
  };
  const commonHeaders = { Authorization: otel.authorization };
  return Layer.mergeAll(
    Logger.layer([
      Logger.consoleStructured,
      OtlpLogger.make({
        url: otel.logsUrl,
        resource,
        headers: { ...commonHeaders, "X-Axiom-Dataset": otel.logsDataset },
        exportInterval: "1 second",
      }),
    ]),
    Layer.effect(
      Tracer.Tracer,
      OtlpTracer.make({
        url: otel.tracesUrl,
        resource,
        headers: { ...commonHeaders, "X-Axiom-Dataset": otel.tracesDataset },
        exportInterval: "1 second",
      }),
    ),
  ).pipe(
    Layer.provideMerge(OtlpExporter.layerFlusher),
    Layer.provide(OtlpSerialization.layerJson),
    Layer.provide(FetchHttpClient.layer),
  );
};

export const withLogging = <A, E, R>(effect: Effect.Effect<A, E, R>, context: LogContext) =>
  effect.pipe(
    Effect.annotateLogs(logAnnotations(context)),
    Effect.annotateSpans(logAnnotations(context)),
    Effect.provideService(References.MinimumLogLevel, context.logLevel ?? "Info"),
    Effect.provide(makeLoggingLayer(context)),
  );

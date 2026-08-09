import { Effect, Layer, Logger, References } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/unstable/observability";
import { readCloudflareEnv, type CloudflareEnv } from "./config";

/**
 * Structured logging standard for Effect code.
 *
 * - Console always writes structured JSON (captured by Workers Logs).
 * - When OTEL_ENDPOINT + AXIOM_TOKEN are configured, spans and log records
 *   also export to the OTLP endpoint (Axiom) so requestId/sessionId/userId
 *   annotations and Effect spans are queryable alongside the console output.
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

export const otelConfigFromResolvedEnv = (env: CloudflareEnv): OtelConfig | undefined => {
  const endpoint = parseOtelEndpoint(env.OTEL_ENDPOINT);
  const token = env.AXIOM_TOKEN?.trim();
  if (!endpoint || !token) return undefined;
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

const logAnnotations = (context: LogContext): Record<string, string> => ({
  ...(context.requestId ? { requestId: context.requestId } : {}),
  ...(context.sessionId ? { sessionId: context.sessionId } : {}),
  ...(context.userId ? { userId: context.userId } : {}),
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
    OtlpTracer.layer({
      url: otel.tracesUrl,
      resource,
      headers: { ...commonHeaders, "X-Axiom-Dataset": otel.tracesDataset },
      exportInterval: "1 second",
    }),
  ).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer));
};

export const withLogging = <A, E, R>(effect: Effect.Effect<A, E, R>, context: LogContext) =>
  effect.pipe(
    Effect.annotateLogs(logAnnotations(context)),
    Effect.provideService(References.MinimumLogLevel, context.logLevel ?? "Info"),
    Effect.provide(makeLoggingLayer(context)),
  );

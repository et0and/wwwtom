import { afterEach, vi } from "vitest";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  logLevelFromEnv,
  otelConfigFromEnv,
  otelConfigFromResolvedEnv,
  withLogging,
} from "../src/services/logging";
import { readCloudflareEnv } from "../src/services/config";

type ConsoleLogRecord = {
  level: string;
  message: string;
  annotations: Record<string, string>;
};

const captureLogs = () => {
  const logs: Array<ConsoleLogRecord> = [];
  vi.spyOn(console, "log").mockImplementation((arg: ConsoleLogRecord) => {
    logs.push(arg);
  });
  return logs;
};

describe("withLogging", () => {
  afterEach(() => vi.restoreAllMocks());

  it.live("annotates requestId, sessionId and userId", () =>
    Effect.gen(function* () {
      const logs = captureLogs();
      yield* withLogging(Effect.logInfo("hello"), {
        serviceName: "tom-api",
        requestId: "req-1",
        sessionId: "session-1",
        userId: "tom@mastodon.social",
      });
      expect(logs[0]).toMatchObject({
        level: "INFO",
        annotations: {
          requestId: "req-1",
          sessionId: "session-1",
          userId: "tom@mastodon.social",
        },
      });
    }),
  );

  it.live("includes Debug logs when logLevel is Debug", () =>
    Effect.gen(function* () {
      const logs = captureLogs();
      yield* withLogging(Effect.logDebug("verbose"), {
        serviceName: "tom-api",
        logLevel: "Debug",
      });
      expect(logs[0]?.level).toBe("DEBUG");
    }),
  );

  it.live("hides Debug logs at the default Info level", () =>
    Effect.gen(function* () {
      const logs = captureLogs();
      yield* withLogging(Effect.logDebug("verbose"), { serviceName: "tom-api" });
      expect(logs).toHaveLength(0);
    }),
  );

  it.live("does not export anywhere when OTEL config is absent", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      yield* withLogging(Effect.logInfo("no otel"), { serviceName: "tom-api" });
      expect(fetchSpy).not.toHaveBeenCalled();
    }),
  );

  it.live("exports logs and spans to the OTLP endpoint when configured", () =>
    Effect.gen(function* () {
      const fetches: Array<{ url: string; authorization: string | null }> = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const headers = new Headers(init?.headers);
        fetches.push({
          url: String(input),
          authorization: headers.get("Authorization"),
        });
        return new Response("ok", { status: 200 });
      });
      yield* withLogging(Effect.logInfo("hello").pipe(Effect.withSpan("test.span")), {
        serviceName: "tom-api",
        otel: {
          tracesUrl: "https://example.com/v1/traces",
          logsUrl: "https://example.com/v1/logs",
          authorization: "Bearer token",
          tracesDataset: "tom-traces",
          logsDataset: "tom-logs",
        },
      });
      const urls = fetches.map((f) => f.url);
      expect(urls).toContain("https://example.com/v1/logs");
      expect(urls).toContain("https://example.com/v1/traces");
      expect(fetches.every((f) => f.authorization === "Bearer token")).toBe(true);
    }),
  );
});

describe("otelConfigFromResolvedEnv", () => {
  it("derives traces and logs URLs from the Axiom endpoint", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "https://oqajujlgyv8i.ingress.axiom.co/collector/event",
      AXIOM_TOKEN: "secret",
    });
    expect(otel).toEqual({
      tracesUrl: "https://oqajujlgyv8i.ingress.axiom.co/v1/traces",
      logsUrl: "https://oqajujlgyv8i.ingress.axiom.co/v1/logs",
      authorization: "Bearer secret",
      tracesDataset: "tom-traces",
      logsDataset: "tom-logs",
    });
  });

  it("defaults to the Axiom cloud endpoint and dataset names when only the token is present", () => {
    const otel = otelConfigFromResolvedEnv({ AXIOM_TOKEN: "secret" });
    expect(otel).toEqual({
      tracesUrl: "https://api.axiom.co/v1/traces",
      logsUrl: "https://api.axiom.co/v1/logs",
      authorization: "Bearer secret",
      tracesDataset: "tom-traces",
      logsDataset: "tom-logs",
    });
  });

  it("returns undefined when the token is missing", () => {
    expect(otelConfigFromResolvedEnv({})).toBeUndefined();
    expect(otelConfigFromResolvedEnv({ OTEL_ENDPOINT: "https://example.com" })).toBeUndefined();
  });

  it("strips trailing slashes from the endpoint", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "https://example.com///",
      AXIOM_TOKEN: "secret",
    });
    expect(otel?.tracesUrl).toBe("https://example.com/v1/traces");
    expect(otel?.logsUrl).toBe("https://example.com/v1/logs");
  });

  it("strips /collector/event suffix and trims whitespace", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "  https://example.com/collector/event  ",
      AXIOM_TOKEN: "secret",
    });
    expect(otel?.tracesUrl).toBe("https://example.com/v1/traces");
  });

  it("strips /collector/event with trailing slashes", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "https://example.com/collector/event///",
      AXIOM_TOKEN: "secret",
    });
    expect(otel?.tracesUrl).toBe("https://example.com/v1/traces");
  });

  it("does not strip /collector/event when not at the end", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "https://example.com/collector/event-extra",
      AXIOM_TOKEN: "secret",
    });
    expect(otel?.tracesUrl).toBe("https://example.com/collector/event-extra/v1/traces");
  });

  it("does not strip mid-path /collector/event segment", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "https://example.com/a/collector/event/b",
      AXIOM_TOKEN: "secret",
    });
    expect(otel?.tracesUrl).toBe("https://example.com/a/collector/event/b/v1/traces");
  });

  it("falls back to Axiom endpoint when OTEL_ENDPOINT is whitespace", () => {
    const otel = otelConfigFromResolvedEnv({
      OTEL_ENDPOINT: "   ",
      AXIOM_TOKEN: "secret",
    });
    expect(otel?.tracesUrl).toBe("https://api.axiom.co/v1/traces");
  });

  it("returns undefined when AXIOM_TOKEN is whitespace", () => {
    expect(otelConfigFromResolvedEnv({ AXIOM_TOKEN: "   " })).toBeUndefined();
  });

  it("trims whitespace from AXIOM_TOKEN", () => {
    const otel = otelConfigFromResolvedEnv({ AXIOM_TOKEN: "  secret  " });
    expect(otel?.authorization).toBe("Bearer secret");
  });

  it("respects custom dataset overrides", () => {
    const otel = otelConfigFromResolvedEnv({
      AXIOM_TOKEN: "secret",
      OTEL_TRACES_DATASET: "custom-traces",
      OTEL_LOGS_DATASET: "custom-logs",
    });
    expect(otel?.tracesDataset).toBe("custom-traces");
    expect(otel?.logsDataset).toBe("custom-logs");
  });

  it("uses default datasets when overrides absent", () => {
    const otel = otelConfigFromResolvedEnv({ AXIOM_TOKEN: "secret" });
    expect(otel?.tracesDataset).toBe("tom-traces");
    expect(otel?.logsDataset).toBe("tom-logs");
  });
});

describe("otelConfigFromEnv", () => {
  it("resolves via readCloudflareEnv", async () => {
    const otel = await otelConfigFromEnv({ AXIOM_TOKEN: "secret" });
    expect(otel?.tracesUrl).toBe("https://api.axiom.co/v1/traces");
  });

  it("returns undefined when token missing", async () => {
    expect(await otelConfigFromEnv({})).toBeUndefined();
  });
});

describe("logLevelFromEnv", () => {
  it("returns Debug when LOG_LEVEL is Debug", () => {
    expect(logLevelFromEnv({ LOG_LEVEL: "Debug" })).toBe("Debug");
  });

  it("returns Info otherwise", () => {
    expect(logLevelFromEnv({})).toBe("Info");
    expect(logLevelFromEnv({ LOG_LEVEL: "Info" })).toBe("Info");
    expect(logLevelFromEnv({ LOG_LEVEL: "debug" })).toBe("Info");
  });
});

describe("withLogging annotations", () => {
  afterEach(() => vi.restoreAllMocks());

  it.live("annotates only provided fields", () =>
    Effect.gen(function* () {
      const logs = captureLogs();
      yield* withLogging(Effect.logInfo("hello"), {
        serviceName: "tom-api",
        requestId: "req-1",
      });
      expect(logs[0]?.annotations).toEqual({ requestId: "req-1" });
    }),
  );

  it.live("omits annotations when none provided", () =>
    Effect.gen(function* () {
      const logs = captureLogs();
      yield* withLogging(Effect.logInfo("hello"), { serviceName: "tom-api" });
      expect(logs[0]?.annotations).toEqual({});
    }),
  );
});

describe("readCloudflareEnv", () => {
  it("resolves the AXIOM_TOKEN Secrets Store binding to its value", async () => {
    const env = await readCloudflareEnv({
      AXIOM_TOKEN: { get: async () => "minted-token" },
      OTEL_TRACES_DATASET: "tom-traces",
    });
    expect(env.AXIOM_TOKEN).toBe("minted-token");
  });

  it("resolves a binding that carries extra platform properties", async () => {
    const binding = {
      get: async () => "minted-token",
      somethingInternal: "present",
    } as const;
    const env = await readCloudflareEnv({ AXIOM_TOKEN: binding });
    expect(env.AXIOM_TOKEN).toBe("minted-token");
  });

  it("keeps a plain string AXIOM_TOKEN (local dev) as-is", async () => {
    const env = await readCloudflareEnv({ AXIOM_TOKEN: "dev-token" });
    expect(env.AXIOM_TOKEN).toBe("dev-token");
  });
});

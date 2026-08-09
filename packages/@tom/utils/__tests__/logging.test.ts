import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { otelConfigFromResolvedEnv, withLogging } from "../src/services/logging";

const captureLogs = () => {
  const logs: Array<Record<string, unknown>> = [];
  vi.spyOn(console, "log").mockImplementation((arg: unknown) => {
    if (typeof arg === "object" && arg !== null) {
      logs.push(arg as Record<string, unknown>);
    }
  });
  return logs;
};

describe("withLogging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("annotates requestId, sessionId and userId", async () => {
    const logs = captureLogs();
    await Effect.runPromise(
      withLogging(Effect.logInfo("hello"), {
        serviceName: "tom-api",
        requestId: "req-1",
        sessionId: "session-1",
        userId: "tom@mastodon.social",
      }),
    );
    expect(logs[0]).toMatchObject({
      level: "INFO",
      annotations: {
        requestId: "req-1",
        sessionId: "session-1",
        userId: "tom@mastodon.social",
      },
    });
  });

  it("includes Debug logs when logLevel is Debug", async () => {
    const logs = captureLogs();
    await Effect.runPromise(
      withLogging(Effect.logDebug("verbose"), { serviceName: "tom-api", logLevel: "Debug" }),
    );
    expect(logs[0]?.level).toBe("DEBUG");
  });

  it("hides Debug logs at the default Info level", async () => {
    const logs = captureLogs();
    await Effect.runPromise(withLogging(Effect.logDebug("verbose"), { serviceName: "tom-api" }));
    expect(logs).toHaveLength(0);
  });

  it("does not export anywhere when OTEL config is absent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await Effect.runPromise(withLogging(Effect.logInfo("no otel"), { serviceName: "tom-api" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("exports logs and spans to the OTLP endpoint when configured", async () => {
    const fetches: Array<{ url: string; authorization: string | null }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const headers = new Headers(init?.headers);
      fetches.push({
        url: String(input),
        authorization: headers.get("Authorization"),
      });
      return new Response("ok", { status: 200 });
    });
    await Effect.runPromise(
      withLogging(Effect.logInfo("hello").pipe(Effect.withSpan("test.span")), {
        serviceName: "tom-api",
        otel: {
          tracesUrl: "https://example.com/v1/traces",
          logsUrl: "https://example.com/v1/logs",
          authorization: "Bearer token",
          tracesDataset: "tom-traces",
          logsDataset: "tom-logs",
        },
      }),
    );
    const urls = fetches.map((f) => f.url);
    expect(urls).toContain("https://example.com/v1/logs");
    expect(urls).toContain("https://example.com/v1/traces");
    expect(fetches.every((f) => f.authorization === "Bearer token")).toBe(true);
  });
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

  it("returns undefined when the endpoint or token is missing", () => {
    expect(otelConfigFromResolvedEnv({})).toBeUndefined();
    expect(otelConfigFromResolvedEnv({ OTEL_ENDPOINT: "https://example.com" })).toBeUndefined();
  });
});

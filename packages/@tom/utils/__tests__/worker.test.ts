import { afterEach, vi } from "vitest";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
  attachRequestContext,
  attachRequestEnv,
  getRequestContext,
  getRequestEnv,
  logApiFailure,
  logContextFromRequest,
  runEffect,
  toErrorMessage,
  toErrorResponse,
} from "../src/services/worker";
import { withLogging } from "../src/services/logging";
import { WorkerEnvMissingError } from "@tom/types/errors";
import { errorResponseSchema } from "@tom/schemas/error";

describe("attachRequestEnv / getRequestEnv", () => {
  it("attaches and retrieves env", () => {
    const req = new Request("https://example.com");
    const env = { PAYLOAD_URL: "https://payload" } as never;
    attachRequestEnv(req, env);
    expect(getRequestEnv(req)).toBe(env);
  });

  it("throws when env not attached", () => {
    const req = new Request("https://example.com");
    expect(() => getRequestEnv(req)).toThrow(WorkerEnvMissingError);
  });

  it("overwrites previous env", () => {
    const req = new Request("https://example.com");
    const env1 = { PAYLOAD_URL: "https://a" } as never;
    const env2 = { PAYLOAD_URL: "https://b" } as never;
    attachRequestEnv(req, env1);
    attachRequestEnv(req, env2);
    expect(getRequestEnv(req)).toBe(env2);
  });
});

describe("attachRequestContext / getRequestContext", () => {
  it("attaches and retrieves context", () => {
    const req = new Request("https://example.com");
    const ctx = { requestId: "req-1", sessionId: "sess-1", userId: "user-1" };
    attachRequestContext(req, ctx);
    expect(getRequestContext(req)).toEqual(ctx);
  });

  it("returns empty object when no context attached", () => {
    const req = new Request("https://example.com");
    expect(getRequestContext(req)).toEqual({});
  });

  it("logContextFromRequest builds LogContext with serviceName", () => {
    const req = new Request("https://example.com");
    attachRequestContext(req, { requestId: "abc", logLevel: "Debug" });
    const ctx = logContextFromRequest(req, "tom-api");
    expect(ctx).toEqual({ serviceName: "tom-api", requestId: "abc", logLevel: "Debug" });
  });
});

type CapturedLog = {
  level: string;
  message: string;
  annotations: Record<string, string>;
};

describe("logApiFailure", () => {
  afterEach(() => vi.restoreAllMocks());

  const capture = () => {
    const logs: Array<CapturedLog> = [];
    vi.spyOn(console, "log").mockImplementation((arg: CapturedLog) => {
      logs.push(arg);
    });
    return logs;
  };

  it.live("logs WARN for 4xx and ERROR for 5xx", () =>
    Effect.gen(function* () {
      const warnLogs = capture();
      yield* withLogging(logApiFailure("bad request", 400), { serviceName: "test" });
      expect(warnLogs[0]?.level).toBe("WARN");
      vi.restoreAllMocks();

      const errorLogs = capture();
      yield* withLogging(logApiFailure("server error", 500), { serviceName: "test" });
      expect(errorLogs[0]?.level).toBe("ERROR");
    }),
  );

  it.live("handles boundary statuses 399, 400, 499, 500", () =>
    Effect.gen(function* () {
      for (const { status, level } of [
        { status: 399, level: "ERROR" },
        { status: 400, level: "WARN" },
        { status: 499, level: "WARN" },
        { status: 500, level: "ERROR" },
      ] as const) {
        const logs = capture();
        yield* withLogging(logApiFailure("msg", status), { serviceName: "test" });
        expect(logs[0]?.level).toBe(level);
        vi.restoreAllMocks();
      }
    }),
  );

  it.live("logs status without cause", () =>
    Effect.gen(function* () {
      const logs: Array<unknown> = [];
      vi.spyOn(console, "log").mockImplementation(
        // oxlint-disable-next-line anti-slop/no-unknown-parameters -- test mock captures Effect log records without a schema
        (arg: unknown) => {
          logs.push(arg);
        },
      );
      yield* withLogging(logApiFailure("with status", 404), { serviceName: "test" });
      const entry = logs[0] as { level: string; message: Array<unknown> };
      expect(entry?.level).toBe("WARN");
      expect(JSON.stringify(entry)).toContain("404");
      const payload = entry.message[1] as { cause?: unknown };
      expect(Object.hasOwn(payload as object, "cause")).toBe(false);
      vi.restoreAllMocks();
    }),
  );

  it.live("logs status with cause for both branches", () =>
    Effect.gen(function* () {
      for (const status of [400, 500]) {
        const logs = capture();
        yield* withLogging(logApiFailure("with cause", status, "root-cause"), {
          serviceName: "test",
        });
        const serialized = JSON.stringify(logs[0]);
        expect(serialized).toContain("root-cause");
        expect(serialized).toContain(String(status));
        expect(serialized).toContain('"cause"');
        vi.restoreAllMocks();
      }
    }),
  );

  it.live("logs ERROR without cause", () =>
    Effect.gen(function* () {
      const logs: Array<unknown> = [];
      vi.spyOn(console, "log").mockImplementation(
        // oxlint-disable-next-line anti-slop/no-unknown-parameters -- test mock captures Effect log records without a schema
        (arg: unknown) => {
          logs.push(arg);
        },
      );
      yield* withLogging(logApiFailure("server no cause", 500), { serviceName: "test" });
      const entry = logs[0] as { level: string; message: Array<unknown> };
      expect(entry?.level).toBe("ERROR");
      expect(JSON.stringify(entry)).toContain("500");
      const payload = entry.message[1] as { cause?: unknown };
      expect(Object.hasOwn(payload as object, "cause")).toBe(false);
      vi.restoreAllMocks();
    }),
  );
});

describe("runEffect", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs an effect with logging context", async () => {
    const result = await runEffect(Effect.succeed(42), { serviceName: "test" });
    expect(result).toBe(42);
  });

  it("propagates log annotations via runEffect", async () => {
    const logs: Array<CapturedLog> = [];
    vi.spyOn(console, "log").mockImplementation((arg: CapturedLog) => {
      logs.push(arg);
    });
    await runEffect(Effect.logInfo("hello"), {
      serviceName: "test",
      requestId: "req-1",
    });
    expect(logs[0]).toMatchObject({ annotations: { requestId: "req-1" } });
  });

  it.effect("runEffect as Effect via tryPromise", () =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        runEffect(Effect.succeed(99), { serviceName: "test" }),
      );
      expect(result).toBe(99);
    }),
  );
});

describe("toErrorResponse", () => {
  it("creates a JSON response with error field", async () => {
    const res = toErrorResponse(400, "Bad Request");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const body = await res.json();
    const decoded = Schema.decodeUnknownSync(errorResponseSchema)(body);
    expect(decoded.error).toBe("Bad Request");
    expect(decoded.cause).toBeUndefined();
  });

  it("includes cause when provided", async () => {
    const res = toErrorResponse(500, "Server Error", "stack trace");
    const body = await res.json();
    const decoded = Schema.decodeUnknownSync(errorResponseSchema)(body);
    expect(decoded.error).toBe("Server Error");
    expect(decoded.cause).toBe("stack trace");
  });

  it("encodes via schema", async () => {
    const res = toErrorResponse(422, "Validation failed");
    expect(res.status).toBe(422);
  });
});

describe("toErrorMessage", () => {
  it("returns Error message for Error causes", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error causes", () => {
    expect(toErrorMessage("string cause")).toBe("string cause");
    expect(toErrorMessage(42)).toBe("42");
    expect(toErrorMessage(null)).toBe("null");
    expect(toErrorMessage(undefined)).toBe("undefined");
  });
});

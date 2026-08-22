import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  createArenaLayer,
  createPayloadLayer,
  createDbLayer,
  AdapterError,
  runAdapter,
} from "../config/effect";

describe("adapter config/effect", () => {
  it("creates arena/payload/db layers", () => {
    const env = { PAYLOAD_URL: "https://cms.tom.so" } as any;
    expect(createArenaLayer(env)).toBeDefined();
    expect(createPayloadLayer(env)).toBeDefined();
    expect(createDbLayer(env)).toBeDefined();
  });

  it("AdapterError carries status and message", () => {
    const err = new AdapterError(404, "not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("not found");
    expect(err._tag).toBe("AdapterError");
    expect(err.name).toBe("AdapterError");
    expect(err instanceof Error).toBe(true);
  });

  it("runAdapter maps errors via toAdapterError", async () => {
    const failing = Effect.fail(new Error("boom"));
    await expect(
      runAdapter(failing, (e) => new AdapterError(500, (e as Error).message), {
        serviceName: "test-adapter",
      }),
    ).rejects.toThrow(AdapterError);
  });

  it("runAdapter resolves on success", async () => {
    const result = await runAdapter(Effect.succeed(42), (e) => new AdapterError(500, String(e)), {
      serviceName: "test-adapter",
    });
    expect(result).toBe(42);
  });

  it("runAdapter provides withLogging context", async () => {
    const result = await runAdapter(
      Effect.gen(function* () {
        yield* Effect.logInfo("test log");
        return "ok" as const;
      }),
      (e) => new AdapterError(500, String(e)),
      { serviceName: "test-adapter" },
    );
    expect(result).toBe("ok");
  });
});

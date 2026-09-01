import { describe, expect, it, vi } from "vitest";
import { Effect, type Layer } from "effect";
import { FlagsError } from "@tom/types/errors";
import { flags, isFlagName } from "../src/registry";
import { evaluateFlags, Flags, type FlagOverrides } from "../src/service";
import { get, type FlagSnapshot } from "../src/client";
import type { FlagshipBinding } from "../src/binding";

const fakeBinding = (): FlagshipBinding => ({
  getBooleanDetails: vi.fn(async (flagKey: string, defaultValue: boolean) =>
    flagKey === "dark-mode"
      ? { value: true, variant: "on", reason: "TARGETING_MATCH" }
      : { value: defaultValue },
  ),
});

const bindingWith = (patch: Partial<FlagshipBinding>): FlagshipBinding => ({
  ...fakeBinding(),
  ...patch,
});

const runWith = <A, E>(
  effect: Effect.Effect<A, E, Flags>,
  layer: Layer.Layer<Flags, never>,
): Promise<A> => Effect.runPromise(Effect.provide(effect, layer));

type Outcome<A, E> =
  | { readonly tag: "error"; readonly error: E }
  | { readonly tag: "success"; readonly value: A };

const runOutcome = <A, E>(
  effect: Effect.Effect<A, E, Flags>,
  layer: Layer.Layer<Flags, never>,
): Promise<Outcome<A, E>> =>
  Effect.runPromise(
    Effect.provide(
      Effect.match(effect, {
        onFailure: (error) => ({ tag: "error" as const, error }),
        onSuccess: (value) => ({ tag: "success" as const, value }),
      }),
      layer,
    ),
  );

describe("registry", () => {
  it("declares every flag with its on/off default", () => {
    expect(flags["dark-mode"].defaultOn).toBe(false);
    expect(flags["checkout-flow"].defaultOn).toBe(true);
  });

  it("accepts only declared keys", () => {
    expect(isFlagName("dark-mode")).toBe(true);
    expect(isFlagName("checkout-flow")).toBe(true);
    expect(isFlagName("dark-mdoe")).toBe(false);
  });
});

describe("Flags.Binding (live layer)", () => {
  it("resolves a flag through the binding", async () => {
    const binding = fakeBinding();
    const result = await runWith(
      Effect.flatMap(Flags, (flags) => flags.evaluate("dark-mode")),
      Flags.Binding(binding),
    );
    expect(result).toEqual({ value: true, variant: "on", reason: "TARGETING_MATCH" });
    expect(binding.getBooleanDetails).toHaveBeenCalledWith("dark-mode", false, undefined);
  });

  it("passes the evaluation context through for targeting rules", async () => {
    const binding = fakeBinding();
    await runWith(
      Effect.flatMap(Flags, (flags) => flags.evaluate("dark-mode", { userId: "user-42" })),
      Flags.Binding(binding),
    );
    expect(binding.getBooleanDetails).toHaveBeenCalledWith("dark-mode", false, {
      userId: "user-42",
    });
  });

  it("falls back to the registered default when the flag is off", async () => {
    const binding = fakeBinding();
    const result = await runWith(
      Effect.flatMap(Flags, (flags) => flags.evaluate("checkout-flow")),
      Flags.Binding(binding),
    );
    expect(result).toEqual({ value: true });
  });

  it("maps unexpected binding failures to FlagsError", async () => {
    const outcome = await runOutcome(
      Effect.flatMap(Flags, (flags) => flags.evaluate("dark-mode")),
      Flags.Binding(
        bindingWith({
          getBooleanDetails: vi.fn(async () => {
            throw new Error("binding broken");
          }),
        }),
      ),
    );
    expect(outcome.tag).toBe("error");
    if (outcome.tag === "error") {
      expect(outcome.error).toBeInstanceOf(FlagsError);
      expect(outcome.error.message).toBe("Failed to evaluate flag dark-mode");
    }
  });
});

describe("Flags.Static (in-memory layer)", () => {
  it("resolves overridden flags and falls back to defaults", async () => {
    const overrides: FlagOverrides = { "dark-mode": false };
    const result = await runWith(
      Effect.flatMap(Flags, (flags) => flags.evaluate("dark-mode")),
      Flags.Static(overrides),
    );
    expect(result).toEqual({ value: false, reason: "CACHED" });
  });

  it("marks overridden values CACHED and defaulted values DEFAULT", async () => {
    const overrides: FlagOverrides = { "dark-mode": true };
    const result = await runWith(
      Effect.gen(function* () {
        const flagsService = yield* Flags;
        const overridden = yield* flagsService.evaluate("dark-mode");
        const defaulted = yield* flagsService.evaluate("checkout-flow");
        return { overridden, defaulted };
      }),
      Flags.Static(overrides),
    );
    expect(result.overridden).toEqual({ value: true, reason: "CACHED" });
    expect(result.defaulted).toEqual({ value: true, reason: "DEFAULT" });
  });
});

describe("evaluateFlags (used-only list)", () => {
  it("evaluates exactly the listed flags", async () => {
    const binding = fakeBinding();
    const result = await runWith(
      evaluateFlags(["dark-mode", "checkout-flow"]),
      Flags.Binding(binding),
    );
    expect(result).toEqual([
      ["dark-mode", { value: true, variant: "on", reason: "TARGETING_MATCH" }],
      ["checkout-flow", { value: true }],
    ]);
    const calls = vi.mocked(binding.getBooleanDetails).mock.calls.map((call) => call[0]);
    expect(calls).toEqual(["dark-mode", "checkout-flow"]);
  });
});

describe("client get", () => {
  it("reads a delivered evaluation from the snapshot", () => {
    const snapshot: FlagSnapshot = {
      "dark-mode": { value: true, reason: "TARGETING_MATCH" },
    };
    expect(get(snapshot, "dark-mode")).toEqual({
      value: true,
      reason: "TARGETING_MATCH",
    });
  });

  it("falls back to the registered default when a flag is not delivered", () => {
    const snapshot: FlagSnapshot = { "dark-mode": { value: true } };
    expect(get(snapshot, "checkout-flow")).toEqual({
      value: true,
      reason: "NOT_DELIVERED",
    });
  });
});

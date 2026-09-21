import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { RunStep } from "../model";

const decodeRunStep = Schema.decodeUnknownSync(RunStep);

describe("Script", () => {
  it("joins a list of lines", () => {
    expect(decodeRunStep({ run: ["pnpm turbo run test", "", "git diff"] }).run).toBe(
      "pnpm turbo run test\n\ngit diff",
    );
  });

  it("passes a single-line command through", () => {
    expect(decodeRunStep({ run: "pnpm turbo run lint" }).run).toBe("pnpm turbo run lint");
  });

  it("rejects a line that is not a string", () => {
    expect(() => decodeRunStep({ run: [1] })).toThrow();
  });
});

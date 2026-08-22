import { describe, expect, it } from "@effect/vitest";
import { checkProfanity, hasProfanity } from "../src/profanity";

describe("hasProfanity", () => {
  it("returns false for clean text", () => {
    expect(hasProfanity("hello world")).toBe(false);
  });

  it("returns true for profane text", () => {
    expect(hasProfanity("shit")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasProfanity("SHIT")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(hasProfanity("")).toBe(false);
  });
});

describe("checkProfanity", () => {
  it("returns hasProfanity false for clean text without message", () => {
    const result = checkProfanity("hello world");
    expect(result).toEqual({ hasProfanity: false });
  });

  it("returns hasProfanity true with message for profane text", () => {
    const result = checkProfanity("shit");
    expect(result.hasProfanity).toBe(true);
    expect(result.message).toBe("Your message contains profanity. Please keep it clean!");
  });

  it("returns false for empty string", () => {
    expect(checkProfanity("").hasProfanity).toBe(false);
  });
});

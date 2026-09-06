import { describe, expect, it } from "vitest";
import { checkProfanity, hasProfanity } from "../src/profanity";

describe("hasProfanity", () => {
  it("passes clean text as clean", () => {
    expect(hasProfanity("hello world")).toBe(false);
  });

  it("passes empty text as clean", () => {
    expect(hasProfanity("")).toBe(false);
  });

  it("flags profanity as profanity", () => {
    expect(hasProfanity("fuck")).toBe(true);
  });
});

describe("checkProfanity", () => {
  it("passes clean text as clean", () => {
    expect(checkProfanity("hello world")).toEqual({ hasProfanity: false });
  });

  it("flags tricky profanity as profanity", () => {
    const result = checkProfanity("well fuck!");
    expect(result.hasProfanity).toBe(true);
    expect(result.message).toBe("Your message contains profanity. Please keep it clean!");
  });
});

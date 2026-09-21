import { describe, expect, it } from "vitest";
import { checkProfanity } from "../src/profanity";

describe("checkProfanity", () => {
  it("passes clean text as clean", () => {
    expect(checkProfanity("hello world")).toEqual({ hasProfanity: false });
  });

  it("passes empty text as clean", () => {
    expect(checkProfanity("")).toEqual({ hasProfanity: false });
  });

  it("flags profanity as profanity", () => {
    expect(checkProfanity("fuck").hasProfanity).toBe(true);
  });

  it("flags tricky profanity as profanity", () => {
    const result = checkProfanity("well fuck!");
    expect(result.hasProfanity).toBe(true);
    expect(result.message).toBe("Your message contains profanity. Please keep it clean!");
  });
});

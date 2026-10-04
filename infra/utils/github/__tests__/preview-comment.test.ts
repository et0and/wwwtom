import { describe, expect, it } from "vitest";
import { Option } from "effect";
import { previewPullRequestNumber } from "../preview-comment.ts";

const number = (value: string | undefined) =>
  Option.getOrUndefined(previewPullRequestNumber(value));

describe("previewPullRequestNumber", () => {
  it("reads the CI env string as a PR number", () => {
    // `PULL_REQUEST` is a string in CI. Decoding it as a number rejected
    // every value, so no preview comment was ever posted.
    expect(number("175")).toBe(175);
    expect(number("1")).toBe(1);
  });

  it("rejects anything that is not a positive whole number", () => {
    for (const value of ["0", "-3", "1.5", "abc", "", " ", "175abc"]) {
      expect(number(value), value).toBeUndefined();
    }
  });

  it("is absent outside a PR deploy", () => {
    expect(number(undefined)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { Option } from "effect";
import { previewCommentBody, previewPullRequestNumber } from "../preview-comment.ts";

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

describe("previewCommentBody", () => {
  it("links every app and names the commit", () => {
    const body = previewCommentBody([
      { name: "Web", url: "https://pr-175-web.tom.so" },
      { name: "Sophie", url: "https://pr-175-sophie.sophie.st" },
    ]);
    expect(body).toContain("- [Web](https://pr-175-web.tom.so)");
    expect(body).toContain("- [Sophie](https://pr-175-sophie.sophie.st)");
    expect(body).toContain("## Preview deployed");
  });

  it("renders a body with no apps rather than throwing", () => {
    expect(previewCommentBody([])).toContain("## Preview deployed");
  });
});

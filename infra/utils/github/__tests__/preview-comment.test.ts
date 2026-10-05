import { describe, expect, it } from "vitest";
import { Option } from "effect";
import { previewCommentBody, previewPullRequestNumber } from "../preview-comment.ts";

/**
 * The GitHub post itself runs inside Alchemy's plan/apply engine, which is
 * not reachable from a unit test: `GitHub.Comment` registers a resource, and
 * only the engine reconciles it. `alchemy/Test` exposes state and stage
 * helpers but not `deploy`, so the post cannot be observed here.
 *
 * These cover the decision the code makes before it registers the resource,
 * which is where the original bug lived: a mis-decoded PR number skipped the
 * post entirely and the deploy stayed green.
 */

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
  const apps = [
    { name: "Web", url: "https://pr-175-web.tom.so" },
    { name: "Sophie", url: "https://pr-175-sophie.sophie.st" },
  ];

  it("links every app", () => {
    const body = previewCommentBody(apps);
    expect(body).toContain("## Preview deployed");
    expect(body).toContain("- [Web](https://pr-175-web.tom.so)");
    expect(body).toContain("- [Sophie](https://pr-175-sophie.sophie.st)");
  });

  it("names the built commit", () => {
    const original = process.env.GITHUB_SHA;
    try {
      process.env.GITHUB_SHA = "3bacc5f0e0a1b2c3d4e5f60718293a4b5c6d7e8";
      expect(previewCommentBody(apps)).toContain("3bacc5f");
    } finally {
      if (original === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = original;
    }
  });

  it("renders a body with no apps rather than throwing", () => {
    expect(previewCommentBody([])).toContain("## Preview deployed");
  });
});

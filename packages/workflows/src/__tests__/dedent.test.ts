import { describe, expect, it } from "vitest";
import { dedent } from "../dedent";

describe("dedent", () => {
  it("strips the common indentation and surrounding blank lines", () => {
    expect(
      dedent(`
        pnpm turbo run test
        git diff --exit-code
      `),
    ).toBe("pnpm turbo run test\ngit diff --exit-code");
  });

  it("keeps relative indentation inside the block", () => {
    expect(dedent("\n    if true; then\n      echo yes\n    fi\n")).toBe(
      "if true; then\n  echo yes\nfi",
    );
  });

  it("returns an empty string for blank input", () => {
    expect(dedent("\n   \n")).toBe("");
  });

  it("does not mangle mixed tab and space indentation", () => {
    expect(dedent("\n        foo\n\tbar\n")).toBe("        foo\n\tbar");
  });
});

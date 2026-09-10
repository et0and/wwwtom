import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { CamusLogo } from "../CamusLogo";

describe("CamusLogo", () => {
  it("renders the mark with inherited fill", () => {
    const { container } = render(() => <CamusLogo />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.innerHTML).toContain("currentColor");
  });
});

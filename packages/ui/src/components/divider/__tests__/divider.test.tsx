import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Divider } from "../divider";

describe("Divider", () => {
  it("renders a horizontal separator by default", () => {
    const { container } = render(() => <Divider />);
    const divider = container.querySelector("[role=separator]")!;
    expect(divider.getAttribute("aria-orientation")).toBe("horizontal");
    expect(divider.getAttribute("data-tomui-component")).toBe("Divider");
  });

  it("supports a vertical orientation", () => {
    const { container } = render(() => <Divider orientation="vertical" />);
    expect(container.querySelector("[role=separator]")!.getAttribute("aria-orientation")).toBe(
      "vertical",
    );
  });

  it("merges caller styles", () => {
    const { container } = render(() => <Divider style={undefined} />);
    expect(container.querySelector("[role=separator]")!.className).not.toBe("");
  });
});

import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders a textarea with three rows by default", () => {
    const { container } = render(() => <Textarea />);
    const textarea = container.querySelector("textarea")!;
    expect(textarea.getAttribute("rows")).toBe("3");
  });

  it("forwards native attributes", () => {
    const { container } = render(() => (
      <Textarea name="note" placeholder="Say something" value="hello" readonly />
    ));
    const textarea = container.querySelector("textarea")!;
    expect(textarea.getAttribute("name")).toBe("note");
    expect(textarea.getAttribute("placeholder")).toBe("Say something");
    expect(textarea.value).toBe("hello");
  });

  it("shows invalid state to assistive technology", () => {
    const { container } = render(() => <Textarea invalid />);
    expect(container.querySelector("textarea")!.getAttribute("aria-invalid")).toBe("true");
    expect(
      container.querySelector("[data-midori-component=Textarea]")!.hasAttribute("data-invalid"),
    ).toBe(true);
  });

  it("exposes the surface as a data attribute", () => {
    const { container } = render(() => <Textarea surface="layer-1" />);
    expect(
      container.querySelector("[data-midori-component=Textarea]")!.getAttribute("data-surface"),
    ).toBe("layer-1");
  });

  it("honours a caller-supplied row count", () => {
    const { container } = render(() => <Textarea rows={6} />);
    expect(container.querySelector("textarea")!.getAttribute("rows")).toBe("6");
  });
});

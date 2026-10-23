import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Label } from "../label";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("Label", () => {
  it("renders a label element bound to htmlFor", () => {
    const { container } = render(() => <Label htmlFor="email">Email</Label>);
    const label = container.querySelector("label")!;

    expect(label.getAttribute("for")).toBe("email");
    expect(label.dataset.tomuiComponent).toBe("Label");
    expect(label.textContent).toBe("Email");
  });

  it("renders the optional marker only when asked", () => {
    const without = render(() => <Label htmlFor="a">Email</Label>);
    expect(without.container.textContent).not.toContain("(optional)");

    const with_ = render(() => (
      <Label htmlFor="a" showOptional>
        Email
      </Label>
    ));
    expect(with_.container.textContent).toContain("(optional)");
  });

  it("renders a span instead of a label when asContent is set", () => {
    const { container } = render(() => (
      <Label asContent htmlFor="a">
        Email
      </Label>
    ));

    expect(container.querySelector("label")).toBeNull();
    expect(container.querySelector("span")).not.toBeNull();
  });

  it("renders the tooltip content when provided", () => {
    const without = render(() => <Label htmlFor="a">Email</Label>);
    expect(without.container.textContent).toBe("Email");

    const with_ = render(() => (
      <Label htmlFor="a" tooltip="Required">
        Email
      </Label>
    ));
    expect(with_.container.textContent).toContain("Required");
  });

  it("falls back to an info glyph when the tooltip has no icon", () => {
    const { container } = render(() => (
      <Label htmlFor="a" tooltip="Required">
        Email
      </Label>
    ));

    expect(container.textContent).toContain("ⓘ");
  });

  it("renders a supplied icon in place of the glyph", () => {
    const { container } = render(() => (
      <Label htmlFor="a" tooltip="Required" icon={<span data-testid="icon" />}>
        Email
      </Label>
    ));

    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull();
    expect(container.textContent).not.toContain("ⓘ");
  });

  it("applies label styling", () => {
    const { container } = render(() => <Label htmlFor="a">Email</Label>);
    expect(classList(container.querySelector("label")!).length).toBeGreaterThan(0);
  });

  it("keeps native label attributes", () => {
    const { container } = render(() => (
      <Label htmlFor="a" id="email-label">
        Email
      </Label>
    ));
    expect(container.querySelector("label")!.getAttribute("id")).toBe("email-label");
  });
});

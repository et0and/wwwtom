import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "../icon-button";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("IconButton", () => {
  it("renders a labelled button with its icon", () => {
    const { container } = render(() => (
      <IconButton label="Close" icon={<span data-testid="icon" />} />
    ));
    const button = container.querySelector("button")!;
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Close");
    expect(container.querySelector("[data-testid=icon]")).not.toBeNull();
  });

  it("applies distinct styles per size", () => {
    const size = (value: "small" | "normal" | "large") =>
      classList(
        render(() => <IconButton label="x" size={value} icon={<span />} />).container.querySelector(
          "button",
        )!,
      ).join(" ");

    expect(size("small")).not.toBe(size("large"));
  });

  it("applies distinct styles per variant", () => {
    const variant = (value: "neutral" | "contrast" | "ghost" | "ghost-muted") =>
      classList(
        render(() => (
          <IconButton label="x" variant={value} icon={<span />} />
        )).container.querySelector("button")!,
      ).join(" ");

    expect(variant("neutral")).not.toBe(variant("ghost"));
    expect(variant("ghost")).not.toBe(variant("ghost-muted"));
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    const { container } = render(() => <IconButton label="x" icon={<span />} onClick={onClick} />);
    fireEvent.click(container.querySelector("button")!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards disabled and custom type", () => {
    const { container } = render(() => (
      <IconButton label="x" icon={<span />} disabled type="submit" />
    ));
    const button = container.querySelector("button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("type")).toBe("submit");
  });
});

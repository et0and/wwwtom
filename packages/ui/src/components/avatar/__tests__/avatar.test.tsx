import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Avatar } from "../avatar";

describe("Avatar", () => {
  it("renders the first grapheme of the fallback", () => {
    const { container } = render(() => <Avatar fallback="alice" />);
    expect(container.textContent).toBe("a");
  });

  it("keeps an emoji fallback in one piece", () => {
    const { container } = render(() => <Avatar fallback="🧑‍🚀 astronaut" />);
    expect(container.textContent).toBe("🧑‍🚀");
  });

  it("renders the image instead of the fallback", () => {
    const { container } = render(() => (
      <Avatar src="https://example.com/a.png" fallback="Alice" alt="Alice" />
    ));
    const image = container.querySelector("img")!;
    expect(image.getAttribute("src")).toBe("https://example.com/a.png");
    expect(image.getAttribute("alt")).toBe("Alice");
    expect(container.textContent).toBe("");
  });

  it("marks decorative images with an empty alt", () => {
    const { container } = render(() => <Avatar src="https://example.com/a.png" fallback="Alice" />);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
  });

  it("exposes size and kind as data attributes", () => {
    const { container } = render(() => <Avatar fallback="Acme" size="normal" kind="org" />);
    const avatar = container.querySelector("[data-tomui-component=Avatar]")!;
    expect(avatar.getAttribute("data-size")).toBe("normal");
    expect(avatar.getAttribute("data-kind")).toBe("org");
  });

  it("applies fixed fallback colours as custom properties", () => {
    const { container } = render(() => (
      <Avatar fallback="A" background="#ff0000" foreground="#ffffff" />
    ));
    const style =
      container.querySelector("[data-tomui-component=Avatar]")!.getAttribute("style") ?? "";
    expect(style).toContain("--avatar-bg");
    expect(style).toContain("--avatar-fg");
  });
});

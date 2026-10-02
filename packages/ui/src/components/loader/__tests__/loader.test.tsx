import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Loader, loaderVariants } from "../loader";

/**
 * Loader size is a dynamic style, so it lands in the `style` attribute as a
 * StyleX custom property rather than a class. jsdom loads no stylesheet, so the
 * attribute is the only observable signal.
 */
const customProps = (element: Element): Record<string, string> => {
  const style = element.getAttribute("style") ?? "";
  return Object.fromEntries(
    style
      .split(";")
      .map((pair) => pair.split(":").map((part) => part.trim()))
      .filter((parts): parts is [string, string] => parts.length === 2),
  );
};

describe("loaderVariants", () => {
  it("maps named sizes to pixels", () => {
    expect(loaderVariants({ size: "sm" })).toBe(16);
    expect(loaderVariants({ size: "base" })).toBe(24);
    expect(loaderVariants({ size: "lg" })).toBe(32);
  });

  it("defaults to base", () => {
    expect(loaderVariants()).toBe(24);
    expect(loaderVariants({ size: undefined })).toBe(24);
  });

  it("passes a raw pixel value through", () => {
    expect(loaderVariants({ size: 40 })).toBe(40);
  });
});

describe("Loader", () => {
  it("renders an accessible status role", () => {
    const { container } = render(() => <Loader />);
    const svg = container.querySelector("svg")!;

    expect(svg.getAttribute("role")).toBe("status");
    expect(svg.getAttribute("aria-label")).toBe("Loading");
    expect(svg.dataset.tomuiComponent).toBe("Loader");
  });

  it("accepts a custom aria-label", () => {
    const { container } = render(() => <Loader aria-label="Loading posts" />);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe("Loading posts");
  });

  it("sizes to the default variant", () => {
    const { container } = render(() => <Loader />);
    const props = customProps(container.querySelector("svg")!);

    expect(props["--x-width"]).toBe("24px");
    expect(props["--x-height"]).toBe("24px");
  });

  it("sizes to each named variant", () => {
    for (const [size, expected] of [
      ["sm", "16px"],
      ["lg", "32px"],
    ] as const) {
      const { container } = render(() => <Loader size={size} />);
      const props = customProps(container.querySelector("svg")!);
      expect(props["--x-width"]).toBe(expected);
    }
  });

  it("accepts a raw pixel size", () => {
    const { container } = render(() => <Loader size={40} />);
    expect(customProps(container.querySelector("svg")!)["--x-width"]).toBe("40px");
  });

  it("animates continuously", () => {
    const { container } = render(() => <Loader />);
    const svg = container.querySelector("svg")!;

    expect(svg.querySelectorAll("animateTransform").length).toBe(1);
    expect(svg.querySelectorAll("animate").length).toBe(2);
  });
});

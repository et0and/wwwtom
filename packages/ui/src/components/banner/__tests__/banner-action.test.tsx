import { fireEvent, render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it, vi } from "vitest";
import { customPropertyName } from "../../../utils/stylex-vars";
import { bannerAccentVars } from "../banner-vars.stylex";
import { BannerAction, BannerActionContext } from "../banner-action";
import type { BannerActionContextValue } from "../banner-action";

/** The generated accent custom property, without hardcoding its hashed name. */
const ACCENT_PROPERTY = customPropertyName(bannerAccentVars.accent);

const callerStyle = stylex.create({ override: { outlineWidth: "3px" } }).override;

const customProps = (element: Element): Record<string, string> => {
  const style = element.getAttribute("style") ?? "";
  return Object.fromEntries(
    style
      .split(";")
      .map((pair) => pair.split(":").map((part) => part.trim()))
      .filter((parts): parts is [string, string] => parts.length === 2),
  );
};

/** Wraps children in the banner context, the way the Banner root does. */
const withBanner = (value: BannerActionContextValue, children: () => JSX.Element) => (
  <BannerActionContext value={value}>{children()}</BannerActionContext>
);

describe("BannerAction", () => {
  it("renders a button carrying the banner size and accent", () => {
    const { container } = render(() =>
      withBanner({ variant: "error", size: "sm" }, () => <BannerAction>Retry</BannerAction>),
    );
    const button = container.querySelector("button")!;

    expect(button.textContent).toBe("Retry");
    expect(button.getAttribute("type")).toBe("button");
    // The accent is read from context and set inline.
    expect(customProps(button)[ACCENT_PROPERTY]).toBeTruthy();
  });

  it("gives each banner variant a different accent", () => {
    const accents = (["default", "alert", "error", "secondary"] as const).map((variant) => {
      const { container } = render(() =>
        withBanner({ variant, size: "sm" }, () => <BannerAction>Retry</BannerAction>),
      );
      return customProps(container.querySelector("button")!)[ACCENT_PROPERTY];
    });

    expect(new Set(accents).size).toBe(4);
  });

  it("maps the secondary variant onto the outline button", () => {
    const { container } = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => (
        <BannerAction variant="secondary">Cancel</BannerAction>
      )),
    );

    const outline = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => (
        <BannerAction variant="primary">Go</BannerAction>
      )),
    ).container.querySelector("button")!;

    expect(container.querySelector("button")!.getAttribute("class")).not.toBe(
      outline.getAttribute("class"),
    );
  });

  it("applies distinct styling per action variant", () => {
    const classFor = (variant: "primary" | "secondary" | "ghost") =>
      render(() =>
        withBanner({ variant: "default", size: "sm" }, () => (
          <BannerAction variant={variant}>x</BannerAction>
        )),
      )
        .container.querySelector("button")!
        .getAttribute("class");

    expect(new Set([classFor("primary"), classFor("secondary"), classFor("ghost")]).size).toBe(3);
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    const { container } = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => (
        <BannerAction onClick={onClick}>Retry</BannerAction>
      )),
    );

    fireEvent.click(container.querySelector("button")!);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the icon when provided", () => {
    const { container } = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => (
        <BannerAction icon={<span data-testid="icon" />}>Retry</BannerAction>
      )),
    );

    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull();
  });

  it("honours the submit button type", () => {
    const { container } = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => (
        <BannerAction type="submit">Send</BannerAction>
      )),
    );

    expect(container.querySelector("button")!.getAttribute("type")).toBe("submit");
  });

  it("merges caller styles", () => {
    const plain = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => <BannerAction>x</BannerAction>),
    ).container.querySelector("button")!;

    const overridden = render(() =>
      withBanner({ variant: "default", size: "sm" }, () => (
        <BannerAction style={callerStyle}>x</BannerAction>
      )),
    ).container.querySelector("button")!;

    expect(overridden.getAttribute("class")).not.toBe(plain.getAttribute("class"));
  });
});

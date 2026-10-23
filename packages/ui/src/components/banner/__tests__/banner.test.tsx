import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import { Banner, bannerVariants } from "../banner";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const callerStyle = stylex.create({ override: { outlineWidth: "3px" } }).override;

describe("bannerVariants", () => {
  it("gives every variant a distinct style", () => {
    expect(bannerVariants({ variant: "default" })).not.toEqual(
      bannerVariants({ variant: "error" }),
    );
  });

  it("gives every size a distinct style", () => {
    expect(bannerVariants({ size: "base" })).not.toEqual(bannerVariants({ size: "sm" }));
  });
});

describe("Banner", () => {
  it("renders the title and description", () => {
    const { container } = render(() => <Banner title="Update available" description="Details" />);
    expect(container.querySelector("[data-tomui-component=Banner]")?.textContent).toContain(
      "Update available",
    );
    expect(container.textContent).toContain("Details");
  });

  it("sets role=alert only for the error variant", () => {
    const { container: error } = render(() => <Banner variant="error" title="Oops" />);
    const { container: info } = render(() => <Banner title="Hi" />);
    expect(error.querySelector("[data-tomui-component=Banner]")?.getAttribute("role")).toBe(
      "alert",
    );
    expect(info.querySelector("[data-tomui-component=Banner]")?.getAttribute("role")).toBeNull();
  });

  it("renders the icon wrapper only when an icon is given", () => {
    const { container: withIcon } = render(() => <Banner title="Hi" icon={<svg />} />);
    const { container: withoutIcon } = render(() => <Banner title="Hi" />);
    expect(withIcon.querySelector("svg")).not.toBeNull();
    expect(withoutIcon.querySelector("svg")).toBeNull();
  });

  it("renders the action inline in compact mode and trailing in base mode", () => {
    const action = <button data-testid="cta">Go</button>;
    const { container: compact } = render(() => (
      <Banner size="sm" title="Hi" description="Desc" action={action} />
    ));
    expect(
      compact.querySelector('[data-slot="banner-action-inline"] [data-testid="cta"]'),
    ).not.toBe(null);

    const { container: base } = render(() => (
      <Banner title="Hi" description="Desc" action={action} />
    ));
    expect(base.querySelector('[data-slot="banner-action-inline"]')).toBeNull();
    expect(base.querySelector('[data-testid="cta"]')).not.toBeNull();
  });

  it("gives each variant a different class", () => {
    const classesFor = (variant: "default" | "alert" | "error" | "secondary") =>
      render(() => <Banner variant={variant} title="Hi" />).container.querySelector(
        "[data-tomui-component=Banner]",
      )!;

    const classes = (["default", "alert", "error", "secondary"] as const).map((variant) =>
      classList(classesFor(variant)).join(" "),
    );
    expect(new Set(classes).size).toBe(4);
  });

  it("merges caller styles last", () => {
    const { container } = render(() => <Banner title="Hi" style={callerStyle} />);
    const base = render(() => <Banner title="Hi" />).container.querySelector(
      "[data-tomui-component=Banner]",
    )!;
    const overridden = container.querySelector("[data-tomui-component=Banner]")!;
    expect(classList(overridden)).not.toEqual(classList(base));
  });
});

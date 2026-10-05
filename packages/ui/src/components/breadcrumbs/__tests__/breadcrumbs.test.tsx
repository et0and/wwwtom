import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import {
  BreadcrumbCurrent,
  BreadcrumbLink,
  Breadcrumbs,
  breadcrumbsVariants,
  BreadcrumbSeparator,
} from "../breadcrumbs";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const callerStyle = stylex.create({ override: { outlineWidth: "3px" } }).override;

describe("breadcrumbsVariants", () => {
  it("gives each size a distinct style", () => {
    expect(breadcrumbsVariants({ size: "sm" })).not.toEqual(breadcrumbsVariants({ size: "base" }));
  });
});

describe("Breadcrumbs", () => {
  const items = [
    { label: "Home", href: "/" },
    { label: "Docs", href: "/docs" },
    { label: "Getting started" },
  ];

  it("renders a link for every item except the last", () => {
    const { container } = render(() => <Breadcrumbs items={items} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("/");
    expect(links[1]?.getAttribute("href")).toBe("/docs");
  });

  it("marks the last item as the current page", () => {
    const { container } = render(() => <Breadcrumbs items={items} />);
    const current = container.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("Getting started");
  });

  it("renders a separator between items but not before the first", () => {
    const { container } = render(() => <Breadcrumbs items={items} />);
    expect(container.querySelectorAll("svg")).toHaveLength(items.length - 1);
  });

  it("renders children when no items are given", () => {
    const { container } = render(() => (
      <Breadcrumbs>
        <BreadcrumbLink href="/">Home</BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbCurrent>Installation</BreadcrumbCurrent>
      </Breadcrumbs>
    ));
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/");
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Installation");
  });

  it("gives each size a different class", () => {
    const { container: sm } = render(() => <Breadcrumbs size="sm" items={items} />);
    const { container: base } = render(() => <Breadcrumbs size="base" items={items} />);
    expect(classList(sm.querySelector("nav")!)).not.toEqual(classList(base.querySelector("nav")!));
  });

  it("merges caller styles last", () => {
    const { container } = render(() => <Breadcrumbs items={items} style={callerStyle} />);
    const plain = render(() => <Breadcrumbs items={items} />).container.querySelector("nav")!;
    expect(classList(container.querySelector("nav")!)).not.toEqual(classList(plain));
  });
});

describe("BreadcrumbCurrent", () => {
  it("truncates its label in a nested span", () => {
    const { container } = render(() => <BreadcrumbCurrent>Installation</BreadcrumbCurrent>);
    const inner = container.querySelector('[aria-current="page"] > span');
    expect(inner?.textContent).toBe("Installation");
  });
});

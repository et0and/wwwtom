import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as stylex from "@stylexjs/stylex";
import { TableOfContents, tocItemVariants } from "../table-of-contents";

/**
 * StyleX compiles to opaque hashed class names and jsdom loads no stylesheet,
 * so these assert on observable output: the class list, DOM attributes, and
 * behaviour.
 */
const callerStyles = stylex.create({ override: { outlineWidth: "3px" } });

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const headings = [
  { id: "introduction", label: "Introduction" },
  { id: "installation", label: "Installation" },
  { id: "usage", label: "Usage", level: 3 },
];

/**
 * jsdom ships no IntersectionObserver. The component only constructs one when
 * `activeId` is uncontrolled, so tests that pass `activeId` never touch this;
 * this stub covers the uncontrolled-scroll-tracking path.
 */
class IntersectionObserverStub {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tocItemVariants", () => {
  it("gives the default and active states different styles", () => {
    expect(tocItemVariants({ state: "default" })).not.toEqual(tocItemVariants({ state: "active" }));
  });
});

describe("TableOfContents", () => {
  it("renders a nav with its default title and every heading link", () => {
    const { container } = render(() => <TableOfContents headings={headings} />);
    const nav = container.querySelector("[data-tomui-component=TableOfContents]")!;
    expect(nav.tagName).toBe("NAV");
    expect(nav.querySelector("p")?.textContent).toBe("On this page");
    expect(container.querySelectorAll("[data-tomui-component=TableOfContentsItem]")).toHaveLength(
      3,
    );
  });

  it("honours a custom title", () => {
    const { container } = render(() => <TableOfContents headings={headings} title="Contents" />);
    expect(container.querySelector("p")?.textContent).toBe("Contents");
  });

  it("marks the controlled activeId as current", () => {
    const { container } = render(() => (
      <TableOfContents headings={headings} activeId="installation" />
    ));
    const items = container.querySelectorAll("[data-tomui-component=TableOfContentsItem]");
    expect(items[1]!.getAttribute("aria-current")).toBe("true");
    expect(items[1]!.hasAttribute("data-active")).toBe(true);
    expect(items[0]!.getAttribute("aria-current")).toBeNull();
    expect(items[0]!.hasAttribute("data-active")).toBe(false);
  });

  it("gives the active item a different class list than an inactive item", () => {
    const { container } = render(() => (
      <TableOfContents headings={headings} activeId="installation" />
    ));
    const items = container.querySelectorAll("[data-tomui-component=TableOfContentsItem]");
    expect(classList(items[1]!)).not.toEqual(classList(items[0]!));
  });

  it("indents a heading past level 2 with an inline padding-inline-start", () => {
    const { container } = render(() => <TableOfContents headings={headings} />);
    const items = container.querySelectorAll("[data-tomui-component=TableOfContentsItem]");
    expect(items[2]!.getAttribute("style")).toContain("padding-inline-start");
    expect(items[0]!.getAttribute("style")).toBeFalsy();
  });

  it("updates the active item on click when uncontrolled", async () => {
    const { container } = render(() => <TableOfContents headings={headings} />);
    const items = container.querySelectorAll("[data-tomui-component=TableOfContentsItem]");
    fireEvent.click(items[1]!);
    await vi.waitFor(() => {
      expect(items[1]!.getAttribute("aria-current")).toBe("true");
    });
  });

  it("merges a caller style onto the nav and lets it win on conflict", () => {
    const plain = render(() => <TableOfContents headings={headings} />).container.querySelector(
      "nav",
    )!;
    const overridden = render(() => (
      <TableOfContents headings={headings} style={callerStyles.override} />
    )).container.querySelector("nav")!;

    const added = classList(overridden).filter((token) => !classList(plain).includes(token));
    expect(added).toHaveLength(1);
  });
});

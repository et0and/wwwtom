import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Link, linkVariants } from "../link";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("Link", () => {
  it("renders an anchor with its href", () => {
    const { container } = render(() => <Link href="/docs">Docs</Link>);
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/docs");
    expect(anchor?.textContent).toBe("Docs");
  });

  it("adds noopener and noreferrer only for new-tab links", () => {
    const { container: blank } = render(() => (
      <Link href="https://example.com" target="_blank">
        Out
      </Link>
    ));
    expect(blank.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");

    const { container: self } = render(() => <Link href="/docs">Docs</Link>);
    expect(self.querySelector("a")?.hasAttribute("rel")).toBe(false);
  });

  it("keeps an explicit rel when given", () => {
    const { container } = render(() => (
      <Link href="https://example.com" target="_blank" rel="external">
        Out
      </Link>
    ));
    expect(container.querySelector("a")?.getAttribute("rel")).toBe("external");
  });

  it("gives each variant a different style", () => {
    const { container: inline } = render(() => <Link href="/a">A</Link>);
    const { container: current } = render(() => (
      <Link href="/a" variant="current">
        A
      </Link>
    ));
    const { container: plain } = render(() => (
      <Link href="/a" variant="plain">
        A
      </Link>
    ));

    expect(classList(inline.querySelector("a")!)).not.toEqual(
      classList(current.querySelector("a")!),
    );
    expect(classList(inline.querySelector("a")!)).not.toEqual(classList(plain.querySelector("a")!));
  });

  it("underlines the inline and current variants but not the plain one", () => {
    expect(linkVariants({ variant: "inline" })).toHaveLength(2);
    expect(linkVariants({ variant: "current" })).toHaveLength(2);
    expect(linkVariants({ variant: "plain" })).toHaveLength(1);
  });

  it("renders the external icon with a compiled stroke width", () => {
    const { container } = render(() => (
      <Link href="https://example.com" target="_blank">
        Out <Link.ExternalIcon />
      </Link>
    ));
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(classList(svg).length).toBeGreaterThan(0);
  });
});

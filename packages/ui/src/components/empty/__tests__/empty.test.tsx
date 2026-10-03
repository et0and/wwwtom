import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Empty } from "../empty";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("Empty", () => {
  it("renders the title", () => {
    const { container } = render(() => <Empty title="Nothing here" />);
    expect(container.querySelector("h2")?.textContent).toBe("Nothing here");
  });

  it("renders the description only when given", () => {
    const { container: withText } = render(() => (
      <Empty title="T" description="Try another search" />
    ));
    expect(withText.textContent).toContain("Try another search");

    const { container: without } = render(() => <Empty title="T" />);
    expect(without.querySelector("p")).toBeNull();
  });

  it("renders the icon when given", () => {
    const { container } = render(() => <Empty title="T" icon={<svg data-testid="icon" />} />);
    expect(container.querySelector("[data-testid=icon]")).not.toBeNull();
  });

  it("shows no copy button without a commandLine", () => {
    const { container } = render(() => <Empty title="T" />);
    expect(container.querySelector("[aria-label='Copy command']")).toBeNull();
  });

  it("shows a copy button when a commandLine is given", () => {
    const { container } = render(() => <Empty title="T" commandLine="npm install @tom/ui" />);
    const button = container.querySelector("[aria-label='Copy command']");
    expect(button).not.toBeNull();
    expect(container.textContent).toContain("npm install @tom/ui");
  });

  it("gives each size a different style", () => {
    const { container: sm } = render(() => <Empty title="T" size="sm" />);
    const { container: lg } = render(() => <Empty title="T" size="lg" />);
    expect(classList(sm.querySelector("[data-tomui-component=Empty]")!)).not.toEqual(
      classList(lg.querySelector("[data-tomui-component=Empty]")!),
    );
  });

  it("applies a compiled style to the command row", () => {
    const { container } = render(() => <Empty title="T" commandLine="ls" />);
    const button = container.querySelector("[aria-label='Copy command']")!;
    expect(classList(button).length).toBeGreaterThan(0);
  });
});

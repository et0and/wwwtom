import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import * as stylex from "@stylexjs/stylex";
import { Toolbar } from "../toolbar";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("Toolbar", () => {
  it("renders a toolbar role with its children", () => {
    const { container } = render(() => (
      <Toolbar>
        <Toolbar.Button>Bold</Toolbar.Button>
      </Toolbar>
    ));
    const root = container.querySelector("[data-tomui-component=Toolbar]");
    expect(root?.getAttribute("role")).toBe("toolbar");
    expect(root?.textContent).toBe("Bold");
  });

  it("applies caller style last so it can override the root", () => {
    const override = stylex.create({ wide: { width: "100%" } });
    const { container } = render(() => <Toolbar style={override.wide} />);
    const root = container.querySelector("[data-tomui-component=Toolbar]")!;
    expect(classList(root).length).toBeGreaterThan(0);
  });

  it("renders a button with its icon and label", () => {
    const { container } = render(() => (
      <Toolbar>
        <Toolbar.Button icon={<span aria-hidden="true">B</span>}>Bold</Toolbar.Button>
      </Toolbar>
    ));
    const button = container.querySelector("[data-tomui-component='Toolbar.Button']")!;
    expect(button.textContent).toBe("BBold");
  });

  it("marks a loading button busy and disabled", () => {
    const { container } = render(() => (
      <Toolbar>
        <Toolbar.Button loading>Saving</Toolbar.Button>
      </Toolbar>
    ));
    const button = container.querySelector("[data-tomui-component='Toolbar.Button']")!;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("renders a link with an href", () => {
    const { container } = render(() => (
      <Toolbar>
        <Toolbar.Link href="#overview">Overview</Toolbar.Link>
      </Toolbar>
    ));
    const link = container.querySelector("[data-tomui-component='Toolbar.Link']")!;
    expect(link.getAttribute("href")).toBe("#overview");
  });

  it("renders an input inside an input group", () => {
    const { container } = render(() => (
      <Toolbar>
        <Toolbar.InputGroup>
          <Toolbar.Input placeholder="Search docs" aria-label="Search docs" />
        </Toolbar.InputGroup>
      </Toolbar>
    ));
    const input = container.querySelector("[data-tomui-component='Toolbar.Input']")!;
    expect(input.getAttribute("data-tomui-toolbar-input")).toBe("");
    expect(input.getAttribute("placeholder")).toBe("Search docs");
  });
});

import { render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import { describe, expect, it } from "vitest";
import { Code, CodeBlock } from "../code";

const renderCode = (ui: JSX.Element) => render(() => ui);

describe("Code", () => {
  it("renders a pre element with the code text", () => {
    const { container } = render(() => <Code code="const x = 1;" />);
    const pre = container.querySelector("pre")!;

    expect(pre.textContent).toBe("const x = 1;");
    expect(pre.dataset.tomuiComponent).toBe("Code");
  });

  it("applies styles", () => {
    const { container } = render(() => <Code code="x" />);
    expect((container.querySelector("pre")!.getAttribute("class") ?? "").length).toBeGreaterThan(0);
  });

  it("interpolates template values", () => {
    const { container } = render(() => (
      <Code code="export KEY={{key}}" values={{ key: { value: "secret" } }} />
    ));

    expect(container.textContent).toBe("export KEY=secret");
  });

  it("marks highlighted template values", () => {
    const plain = render(() => <Code code="key={{k}}" values={{ k: { value: "v" } }} />);
    const plainSpans = plain.container.querySelectorAll("pre span");

    const marked = render(() => (
      <Code code="key={{k}}" values={{ k: { value: "v", highlight: true } }} />
    ));
    const markedSpans = marked.container.querySelectorAll("pre span");

    expect(markedSpans.length).toBe(plainSpans.length);
    expect(markedSpans[0]!.getAttribute("class") ?? "").not.toBe(
      plainSpans[0]!.getAttribute("class") ?? "",
    );
  });

  it("leaves unknown template placeholders untouched", () => {
    const { container } = render(() => (
      <Code code="a={{known}} b={{missing}}" values={{ known: { value: "1" } }} />
    ));

    expect(container.textContent).toContain("b={{missing}}");
  });
});

describe("CodeBlock", () => {
  it("wraps the code in a bordered container", () => {
    const { container } = renderCode(<CodeBlock code="const x = 1;" />);

    expect(container.querySelector("pre")).not.toBeNull();
    expect((container.firstElementChild!.getAttribute("class") ?? "").length).toBeGreaterThan(0);
  });

  it("is reachable as Code.Block", () => {
    const { container } = renderCode(<Code.Block code="const x = 1;" />);
    expect(container.querySelector("pre")!.textContent).toBe("const x = 1;");
  });

  it("indents the code inside the container", () => {
    const bare = render(() => <Code code="x" />).container.querySelector("pre")!;
    const blocked = renderCode(<CodeBlock code="x" />).container.querySelector("pre")!;

    // The block adds its own inset padding, so the two differ.
    expect(blocked.getAttribute("class")).not.toBe(bare.getAttribute("class"));
  });
});

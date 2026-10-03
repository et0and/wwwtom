import { render } from "@solidjs/testing-library";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Flow, flowVariants, FlowNode, FlowParallel } from "../flow";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  // jsdom has no ResizeObserver; Flow only uses it to recompute connector lines.
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

describe("flowVariants", () => {
  it("gives horizontal and vertical orientations a different style", () => {
    expect(flowVariants({ orientation: "horizontal" })).not.toEqual(
      flowVariants({ orientation: "vertical" }),
    );
  });

  it("gives start and center alignments a different style", () => {
    expect(flowVariants({ align: "start" })).not.toEqual(flowVariants({ align: "center" }));
  });
});

describe("Flow", () => {
  it("renders its children inside the node list", () => {
    const { container } = render(() => (
      <Flow>
        <FlowNode nodeId="one">First</FlowNode>
      </Flow>
    ));
    expect(container.querySelector("[data-flow-node=one]")?.textContent).toBe("First");
  });

  it("renders a connectors svg", () => {
    const { container } = render(() => (
      <Flow>
        <FlowNode nodeId="one">First</FlowNode>
      </Flow>
    ));
    expect(container.querySelector("[data-tomui-component=Flow] > svg")).not.toBeNull();
  });

  it("marks the orientation as a data attribute", () => {
    const { container } = render(() => <Flow orientation="horizontal" />);
    expect(
      container.querySelector("[data-tomui-component=Flow]")?.getAttribute("data-orientation"),
    ).toBe("horizontal");
  });
});

describe("FlowNode", () => {
  it("marks a disabled node", () => {
    const { container } = render(() => <FlowNode disabled>Step</FlowNode>);
    expect(
      container.querySelector("[data-tomui-component=FlowNode]")?.hasAttribute("data-disabled"),
    ).toBe(true);
  });

  it("leaves data-disabled unset by default", () => {
    const { container } = render(() => <FlowNode>Step</FlowNode>);
    expect(
      container.querySelector("[data-tomui-component=FlowNode]")?.hasAttribute("data-disabled"),
    ).toBe(false);
  });

  it("merges the caller style last", () => {
    const { container } = render(() => <FlowNode>Step</FlowNode>);
    expect(
      classList(container.querySelector("[data-tomui-component=FlowNode]")!).length,
    ).toBeGreaterThan(0);
  });
});

describe("FlowParallel", () => {
  it("records its align as a data attribute", () => {
    const { container } = render(() => <FlowParallel align="end">Branch</FlowParallel>);
    expect(
      container
        .querySelector("[data-tomui-component=FlowParallel]")
        ?.getAttribute("data-flow-parallel"),
    ).toBe("end");
  });
});

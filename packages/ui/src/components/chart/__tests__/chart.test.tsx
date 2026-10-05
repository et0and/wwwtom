import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Chart, chartVariants } from "../chart";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("chartVariants", () => {
  it("gives each size a different style", () => {
    expect(chartVariants({ size: "sm" })).not.toEqual(chartVariants({ size: "lg" }));
  });
});

describe("Chart", () => {
  it("renders nothing extra without data", () => {
    const { container } = render(() => <Chart />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a polyline for the line type", () => {
    const { container } = render(() => (
      <Chart
        type="line"
        data={[
          { label: "a", value: 1 },
          { label: "b", value: 2 },
        ]}
      />
    ));
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("renders a rect per datum for the bar type", () => {
    const { container } = render(() => (
      <Chart
        type="bar"
        data={[
          { label: "a", value: 1 },
          { label: "b", value: 2 },
        ]}
      />
    ));
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });

  it("renders a sparkline polyline for the sparkline type", () => {
    const { container } = render(() => (
      <Chart
        type="sparkline"
        data={[
          { label: "a", value: 1 },
          { label: "b", value: 2 },
        ]}
      />
    ));
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("applies an explicit height as an inline style", () => {
    const { container } = render(() => <Chart height={120} />);
    const root = container.querySelector("[data-tomui-component=Chart]") as HTMLElement;
    expect(root.style.height).toBe("120px");
  });

  it("gives each size a different class list", () => {
    const { container: sm } = render(() => <Chart size="sm" />);
    const { container: lg } = render(() => <Chart size="lg" />);
    expect(classList(sm.querySelector("[data-tomui-component=Chart]")!)).not.toEqual(
      classList(lg.querySelector("[data-tomui-component=Chart]")!),
    );
  });

  it("calls renderChart with the host element", async () => {
    const renderChart = vi.fn();
    render(() => <Chart renderChart={renderChart} />);
    await vi.waitFor(() => expect(renderChart).toHaveBeenCalledWith(expect.any(HTMLDivElement)));
  });
});

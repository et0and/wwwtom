import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Meter } from "../meter";

const indicatorWidth = (container: HTMLElement): string =>
  (container.querySelector("[data-tomui-component=Meter] > div > div") as HTMLElement).style.width;

describe("Meter", () => {
  it("exposes the value through meter ARIA attributes", () => {
    const { container } = render(() => <Meter value={40} label="Usage" />);
    const meter = container.querySelector("[role=meter]")!;
    expect(meter.getAttribute("aria-valuenow")).toBe("40");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
    expect(meter.getAttribute("aria-label")).toBe("Usage");
  });

  it("renders the percentage by default", () => {
    const { container } = render(() => <Meter value={40} label="Usage" />);
    expect(container.textContent).toContain("40%");
  });

  it("prefers customValue over the percentage", () => {
    const { container } = render(() => <Meter value={40} label="Usage" customValue="4 GB" />);
    expect(container.textContent).toContain("4 GB");
    expect(container.textContent).not.toContain("40%");
  });

  it("hides the value when showValue is false and no customValue is set", () => {
    const { container } = render(() => <Meter value={40} label="Usage" showValue={false} />);
    expect(container.textContent).not.toContain("40%");
  });

  it("scales the indicator against min and max", () => {
    const { container } = render(() => <Meter value={15} min={10} max={20} label="Progress" />);
    expect(indicatorWidth(container)).toBe("50%");
  });

  it("clamps the indicator to the 0 to 100 range", () => {
    const { container: high } = render(() => <Meter value={500} label="Over" />);
    expect(indicatorWidth(high)).toBe("100%");
    const { container: low } = render(() => <Meter value={-20} label="Under" />);
    expect(indicatorWidth(low)).toBe("0%");
  });

  it("collapses the indicator when the range is empty", () => {
    const { container } = render(() => <Meter value={5} min={5} max={5} label="Empty" />);
    expect(indicatorWidth(container)).toBe("0%");
  });
});

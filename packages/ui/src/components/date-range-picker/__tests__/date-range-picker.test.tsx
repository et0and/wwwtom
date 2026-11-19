import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../date-range-picker";

describe("DateRangePicker", () => {
  it("renders the default range", () => {
    const { container } = render(() => (
      <DateRangePicker defaultStart="2026-09-01" defaultEnd="2026-09-06" />
    ));
    const inputs = container.querySelectorAll("input");
    expect((inputs[0] as HTMLInputElement).value).toBe("2026-09-01");
    expect((inputs[1] as HTMLInputElement).value).toBe("2026-09-06");
  });

  it("updates an uncontrolled start date and flags an invalid range", async () => {
    const { container } = render(() => (
      <DateRangePicker defaultStart="2026-09-01" defaultEnd="2026-09-06" />
    ));
    const start = container.querySelectorAll("input")[0]!;
    fireEvent.change(start, { target: { value: "2026-09-10" } });

    await vi.waitFor(() => {
      expect((start as HTMLInputElement).value).toBe("2026-09-10");
      expect(container.querySelector("[role=alert]")?.textContent).toContain("Start date");
    });
  });
});

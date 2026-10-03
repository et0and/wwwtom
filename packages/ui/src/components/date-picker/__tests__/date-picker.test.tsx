import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "../date-picker";

describe("DatePicker", () => {
  it("renders a date input", () => {
    const { container } = render(() => <DatePicker />);
    const input = container.querySelector("input");
    expect(input?.getAttribute("type")).toBe("date");
  });

  it("reports the new value through onChange", () => {
    const onChange = vi.fn();
    const { container } = render(() => <DatePicker onChange={onChange} />);
    fireEvent.change(container.querySelector("input")!, { target: { value: "2026-01-02" } });
    expect(onChange).toHaveBeenCalledWith("2026-01-02");
  });

  it("shows the given value", () => {
    const { container } = render(() => <DatePicker value="2026-03-04" />);
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("2026-03-04");
  });

  it("forwards native attributes and keeps its own size prop off the element", () => {
    const { container } = render(() => <DatePicker size="lg" min="2026-01-01" name="due" />);
    const input = container.querySelector("input");
    expect(input?.getAttribute("min")).toBe("2026-01-01");
    expect(input?.getAttribute("name")).toBe("due");
    expect(input?.hasAttribute("size")).toBe(false);
  });
});

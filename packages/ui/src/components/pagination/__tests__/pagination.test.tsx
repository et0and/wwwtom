import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "../pagination";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("Pagination", () => {
  it("renders first, previous, pages, next, and last by default", () => {
    const { container } = render(() => <Pagination page={5} pageCount={10} />);
    expect(container.querySelector('[aria-label="First page"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Previous page"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next page"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Last page"]')).not.toBeNull();
  });

  it("hides first and last in the simple variant", () => {
    const { container } = render(() => <Pagination controls="simple" page={3} pageCount={8} />);
    expect(container.querySelector('[aria-label="First page"]')).toBeNull();
    expect(container.querySelector('[aria-label="Last page"]')).toBeNull();
    expect(container.querySelector('[aria-label="Previous page"]')).not.toBeNull();
  });

  it("disables previous and first on the first page", () => {
    const { container } = render(() => <Pagination page={1} pageCount={10} />);
    expect(container.querySelector('[aria-label="Previous page"]')!.hasAttribute("disabled")).toBe(
      true,
    );
    expect(container.querySelector('[aria-label="First page"]')!.hasAttribute("disabled")).toBe(
      true,
    );
    expect(container.querySelector('[aria-label="Next page"]')!.hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("disables next and last on the last page", () => {
    const { container } = render(() => <Pagination page={10} pageCount={10} />);
    expect(container.querySelector('[aria-label="Next page"]')!.hasAttribute("disabled")).toBe(
      true,
    );
    expect(container.querySelector('[aria-label="Last page"]')!.hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("reports the clicked page through onChange", () => {
    const onChange = vi.fn();
    const { container } = render(() => <Pagination page={5} pageCount={10} onChange={onChange} />);
    fireEvent.click(container.querySelector('[aria-label="Page 6"]')!);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("marks the current page with aria-current and a different style", () => {
    const { container } = render(() => <Pagination page={5} pageCount={10} />);
    const current = container.querySelector('[aria-label="Page 5"]')!;
    const other = container.querySelector('[aria-label="Page 4"]')!;
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(other.getAttribute("aria-current")).toBeNull();
    expect(classList(current)).not.toEqual(classList(other));
  });

  it("navigates to the first and last page", () => {
    const onChange = vi.fn();
    const { container } = render(() => <Pagination page={5} pageCount={10} onChange={onChange} />);
    fireEvent.click(container.querySelector('[aria-label="First page"]')!);
    expect(onChange).toHaveBeenCalledWith(1);
    fireEvent.click(container.querySelector('[aria-label="Last page"]')!);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("clamps page to a single-page pageCount", () => {
    const { container } = render(() => <Pagination page={1} pageCount={1} />);
    expect(container.querySelector('[aria-label="Previous page"]')!.hasAttribute("disabled")).toBe(
      true,
    );
    expect(container.querySelector('[aria-label="Next page"]')!.hasAttribute("disabled")).toBe(
      true,
    );
  });
});

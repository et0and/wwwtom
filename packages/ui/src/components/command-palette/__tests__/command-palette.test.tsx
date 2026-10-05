import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../command-palette";

const items = [
  { id: "one", label: "Open file" },
  { id: "two", label: "Copy path", hint: "⌘C" },
  { id: "three", label: "Delete file", disabled: true },
];

describe("CommandPalette", () => {
  it("renders nothing while closed", () => {
    const { container } = render(() => <CommandPalette items={items} />);
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("renders the dialog and search input when open", () => {
    const { container } = render(() => <CommandPalette open items={items} />);
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("shows the default empty message when there are no items", () => {
    const { container } = render(() => <CommandPalette open items={[]} />);
    expect(container.textContent).toContain("No results found");
  });

  it("filters the list by the query", async () => {
    const { container } = render(() => <CommandPalette open items={items} />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "copy" } });

    await vi.waitFor(() => {
      const options = container.querySelectorAll("[role=option]");
      expect(options).toHaveLength(1);
      expect(options[0]?.textContent).toContain("Copy path");
    });
  });

  it("marks the active option with data-active and aria-selected", () => {
    const { container } = render(() => <CommandPalette open items={items} />);
    const options = container.querySelectorAll("[role=option]");
    expect(options[0]?.getAttribute("data-active")).toBe("true");
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    expect(options[1]?.getAttribute("aria-selected")).toBe("false");
  });

  it("never marks a disabled option active", () => {
    const { container } = render(() => <CommandPalette open items={items} />);
    const disabled = Array.from(container.querySelectorAll("[role=option]")).find((option) =>
      option.hasAttribute("disabled"),
    );
    expect(disabled?.hasAttribute("data-active")).toBe(false);
  });

  it("moves the active option when the pointer moves over it", async () => {
    const { container } = render(() => <CommandPalette open items={items} />);
    const options = container.querySelectorAll("[role=option]");

    fireEvent.mouseMove(options[1]!);

    await vi.waitFor(() => expect(options[1]?.getAttribute("data-active")).toBe("true"));
  });

  it("reports the chosen item through onSelect", () => {
    const onSelect = vi.fn();
    const { container } = render(() => <CommandPalette open items={items} onSelect={onSelect} />);

    fireEvent.click(container.querySelectorAll("[role=option]")[1]!);

    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("renders an item hint when one is given", () => {
    const { container } = render(() => <CommandPalette open items={items} />);
    expect(container.textContent).toContain("⌘C");
  });
});

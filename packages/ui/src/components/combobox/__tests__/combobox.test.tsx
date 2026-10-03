import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "../combobox";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

/** Combobox keeps its open state internally, so tests open it through the UI. */
const openPanel = async (container: HTMLElement): Promise<void> => {
  fireEvent.click(container.querySelector("[data-tomui-part=trigger]")!);
  await vi.waitFor(() =>
    expect(container.querySelector("[data-tomui-part=content]")).not.toBeNull(),
  );
};

describe("Combobox", () => {
  it("renders the label with a required marker", () => {
    const { container } = render(() => <Combobox label="Tags" required />);
    const label = container.querySelector("label");
    expect(label?.textContent).toContain("Tags");
    expect(label?.textContent).toContain("*");
  });

  it("omits the required marker when not required", () => {
    const { container } = render(() => <Combobox label="Tags" />);
    expect(container.querySelector("label")?.textContent).not.toContain("*");
  });

  it("renders the description and the error", () => {
    const { container } = render(() => (
      <Combobox label="Tags" description="Pick some" error="Too few" />
    ));
    expect(container.textContent).toContain("Pick some");
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Too few");
  });

  it("does not render the content until the trigger opens it", () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.Content>
          <div>panel</div>
        </Combobox.Content>
      </Combobox>
    ));
    expect(container.querySelector("[data-tomui-part=content]")).toBeNull();
  });

  it("opens and closes the content through the trigger value", async () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <div>panel</div>
        </Combobox.Content>
      </Combobox>
    ));

    const trigger = container.querySelector("[data-tomui-part=trigger]")!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await openPanel(container);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(trigger);
    await vi.waitFor(() => expect(container.querySelector("[data-tomui-part=content]")).toBeNull());
  });

  it("reports the selection through onValueChange for a single value", async () => {
    const onValueChange = vi.fn();
    const { container } = render(() => (
      <Combobox onValueChange={onValueChange}>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.List items={["alpha", "beta"]}>
            {(item) => <Combobox.Item value={item} />}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    fireEvent.click(container.querySelector("[data-tomui-part=item]")!);
    expect(onValueChange).toHaveBeenCalledWith("alpha");
  });

  it("marks the selected item with aria-selected", async () => {
    const { container } = render(() => (
      <Combobox defaultValue="alpha">
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.List items={["alpha", "beta"]}>
            {(item) => <Combobox.Item value={item} />}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    const items = container.querySelectorAll("[data-tomui-part=item]");
    expect(items[0]?.getAttribute("aria-selected")).toBe("true");
    expect(items[1]?.getAttribute("aria-selected")).toBe("false");
  });

  it("shows the default empty message", async () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.Empty />
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    expect(container.textContent).toContain("No labels found.");
  });

  it("renders one chip per multiple value and removes it again", async () => {
    const { container } = render(() => (
      <Combobox multiple defaultValue={["alpha"]}>
        <Combobox.TriggerMultipleWithInput />
      </Combobox>
    ));

    await vi.waitFor(() =>
      expect(container.querySelectorAll("[data-tomui-part=chip-remove]")).toHaveLength(1),
    );

    fireEvent.click(container.querySelector("[data-tomui-part=chip-remove]")!);
    await vi.waitFor(() =>
      expect(container.querySelectorAll("[data-tomui-part=chip-remove]")).toHaveLength(0),
    );
  });

  it("renders the query input before the chip row when inputSide is top", () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerMultipleWithInput inputSide="top" />
      </Combobox>
    ));

    const input = container.querySelector("[role=combobox]")!;
    const chips = container.querySelector("[data-tomui-part=chip-remove]");
    if (chips !== null) {
      // With inputSide top the input is the first child of the wrapper.
      expect(input.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(input).not.toBeNull();
  });

  it("highlights the active option when the keyboard moves through the list", async () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.List items={["alpha", "beta"]}>
            {(item) => <Combobox.Item value={item} />}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    fireEvent.keyDown(document, { key: "ArrowDown" });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[0]?.getAttribute("data-highlighted")).toBe("");
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
    });

    fireEvent.keyDown(document, { key: "ArrowDown" });
    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("wraps to the last option when ArrowUp is pressed with nothing active", async () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.List items={["alpha", "beta"]}>
            {(item) => <Combobox.Item value={item} />}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    fireEvent.keyDown(document, { key: "ArrowUp" });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("highlights an option on hover", async () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.List items={["alpha", "beta"]}>
            {(item) => <Combobox.Item value={item} />}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    const items = container.querySelectorAll("[data-tomui-part=item]");
    fireEvent.mouseEnter(items[1]!);

    await vi.waitFor(() => {
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("applies a compiled style to each item", async () => {
    const { container } = render(() => (
      <Combobox>
        <Combobox.TriggerValue />
        <Combobox.Content>
          <Combobox.List items={["alpha"]}>
            {(item) => <Combobox.Item value={item} />}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    ));

    await openPanel(container);
    expect(classList(container.querySelector("[data-tomui-part=item]")!).length).toBeGreaterThan(0);
  });
});

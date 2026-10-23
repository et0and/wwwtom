import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete } from "../autocomplete";

describe("Autocomplete", () => {
  it("renders the label, description, and error", () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]} label="Fruit" description="Type to filter" error="Pick one">
        <Autocomplete.InputGroup />
      </Autocomplete>
    ));

    expect(container.querySelector("label")?.textContent).toContain("Fruit");
    expect(container.textContent).toContain("Type to filter");
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Pick one");
  });

  it("does not render the content before the input opens it", () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <div>panel</div>
        </Autocomplete.Content>
      </Autocomplete>
    ));
    expect(container.querySelector("[data-tomui-part=content]")).toBeNull();
  });

  it("opens the content and lists the items once the input is focused", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha", "beta"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-tomui-part=input]")!);
    await vi.waitFor(() =>
      expect(container.querySelectorAll("[data-tomui-part=item]")).toHaveLength(2),
    );
  });

  it("marks the item that matches the query as selected", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]} defaultValue="beta">
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha", "beta"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-tomui-part=input]") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "beta" } });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[1]?.getAttribute("aria-selected")).toBe("true");
      expect(items[0]?.getAttribute("aria-selected")).toBe("false");
    });
  });

  it("renders the check mark only on the selected item", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]} defaultValue="alpha">
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha", "beta"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-tomui-part=input]") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "alpha" } });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      // Only the selected item renders its check column.
      expect(items[0]?.querySelectorAll("svg")).toHaveLength(1);
      expect(items[1]?.querySelectorAll("svg")).toHaveLength(0);
    });
  });

  it("closes the content when an item is chosen", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-tomui-part=input]")!);
    await vi.waitFor(() =>
      expect(container.querySelector("[data-tomui-part=content]")).not.toBeNull(),
    );

    fireEvent.click(container.querySelector("[data-tomui-part=item]")!);
    await vi.waitFor(() => expect(container.querySelector("[data-tomui-part=content]")).toBeNull());
  });

  it("shows the default empty message", async () => {
    const { container } = render(() => (
      <Autocomplete items={[]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.Empty />
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-tomui-part=input]")!);
    await vi.waitFor(() => expect(container.textContent).toContain("No results found."));
  });

  it("highlights the active option when the keyboard moves it down", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha", "beta"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-tomui-part=input]")!;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[0]?.getAttribute("data-highlighted")).toBe("");
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("wraps to the last option when ArrowUp is pressed with nothing active", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha", "beta"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-tomui-part=input]")!;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-tomui-part=item]");
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("highlights an option on hover", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha", "beta"]}>
            {(item) => <Autocomplete.Item value={item} />}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-tomui-part=input]")!);
    await vi.waitFor(() =>
      expect(container.querySelectorAll("[data-tomui-part=item]")).toHaveLength(2),
    );
    const items = container.querySelectorAll("[data-tomui-part=item]");
    fireEvent.mouseEnter(items[1]!);

    await vi.waitFor(() => {
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("links the input to the list it controls", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List items={["alpha"]}>{(item) => <div>{item}</div>}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-tomui-part=input]")!);
    await vi.waitFor(() => {
      const input = container.querySelector("[data-tomui-part=input]")!;
      const list = container.querySelector("[role=listbox]")!;
      expect(input.getAttribute("aria-controls")).toBe(list.id);
    });
  });
});

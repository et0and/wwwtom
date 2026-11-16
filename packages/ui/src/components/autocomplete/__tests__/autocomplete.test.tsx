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
    expect(container.querySelector("[data-midori-part=content]")).toBeNull();
  });

  it("opens the content and lists the items once the input is focused", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-midori-part=input]")!);
    await vi.waitFor(() =>
      expect(container.querySelectorAll("[data-midori-part=item]")).toHaveLength(2),
    );
  });

  it("marks the item that matches the query as selected", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]} defaultValue="beta">
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-midori-part=input]") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "beta" } });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-midori-part=item]");
      expect(items).toHaveLength(1);
      expect(items[0]?.getAttribute("aria-selected")).toBe("true");
    });
  });

  it("renders the check mark only on the selected item", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]} defaultValue="alpha">
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-midori-part=input]") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "alpha" } });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-midori-part=item]");
      expect(items).toHaveLength(1);
      expect(items[0]?.querySelectorAll("svg")).toHaveLength(1);
    });
  });

  it("closes the content when an item is chosen", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-midori-part=input]")!);
    await vi.waitFor(() =>
      expect(container.querySelector("[data-midori-part=content]")).not.toBeNull(),
    );

    fireEvent.click(container.querySelector("[data-midori-part=item]")!);
    await vi.waitFor(() =>
      expect(container.querySelector("[data-midori-part=content]")).toBeNull(),
    );
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

    fireEvent.focus(container.querySelector("[data-midori-part=input]")!);
    await vi.waitFor(() => expect(container.textContent).toContain("No results found."));
  });

  it("highlights the active option when the keyboard moves it down", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-midori-part=input]")!;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-midori-part=item]");
      expect(items[0]?.getAttribute("data-highlighted")).toBe("");
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-midori-part=item]");
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("wraps to the last option when ArrowUp is pressed with nothing active", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-midori-part=input]")!;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-midori-part=item]");
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("highlights an option on hover", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-midori-part=input]")!);
    await vi.waitFor(() =>
      expect(container.querySelectorAll("[data-midori-part=item]")).toHaveLength(2),
    );
    const items = container.querySelectorAll("[data-midori-part=item]");
    fireEvent.mouseEnter(items[1]!);

    await vi.waitFor(() => {
      expect(items[1]?.getAttribute("data-highlighted")).toBe("");
    });
  });

  it("filters the list by the query", async () => {
    const { container } = render(() => (
      <Autocomplete items={["Apple", "Banana", "Cherry"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
          <Autocomplete.Empty />
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-midori-part=input]") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "an" } });

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-midori-part=item]");
      expect(Array.from(items, (item) => item.textContent)).toEqual(["Banana"]);
    });

    fireEvent.input(input, { target: { value: "zzz" } });
    await vi.waitFor(() => {
      expect(container.querySelectorAll("[data-midori-part=item]")).toHaveLength(0);
      expect(container.textContent).toContain("No results found.");
    });
  });

  it("selects the active option with Enter", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha", "beta"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const input = container.querySelector("[data-midori-part=input]") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    await vi.waitFor(() => {
      expect(
        container.querySelector("[data-midori-part=item]")?.getAttribute("data-highlighted"),
      ).toBe("");
    });

    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(input.value).toBe("alpha");
      expect(container.querySelector("[data-midori-part=content]")).toBeNull();
    });
  });

  it("opens by default and associates its label with the input", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]} label="Fruit" defaultOpen>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <Autocomplete.Item value={item} />}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    const label = container.querySelector("label")!;
    const input = container.querySelector("[data-midori-part=input]")!;
    expect(label.getAttribute("for")).toBe(input.id);
    expect(container.querySelector("[data-midori-part=content]")).not.toBeNull();
  });

  it("links the input to the list it controls", async () => {
    const { container } = render(() => (
      <Autocomplete items={["alpha"]}>
        <Autocomplete.InputGroup />
        <Autocomplete.Content>
          <Autocomplete.List>{(item) => <div>{item}</div>}</Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    ));

    fireEvent.focus(container.querySelector("[data-midori-part=input]")!);
    await vi.waitFor(() => {
      const input = container.querySelector("[data-midori-part=input]")!;
      const list = container.querySelector("[role=listbox]")!;
      expect(input.getAttribute("aria-controls")).toBe(list.id);
    });
  });
});

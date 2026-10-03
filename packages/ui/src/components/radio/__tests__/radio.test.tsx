import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Radio } from "../radio";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const itemOf = (container: HTMLElement): HTMLInputElement =>
  container.querySelector("[data-tomui-part=item]")!;

describe("Radio", () => {
  it("renders a radiogroup with the items inside", () => {
    const { container } = render(() => (
      <Radio>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </Radio>
    ));

    expect(container.querySelector("[role=radiogroup]")).not.toBeNull();
    expect(container.querySelectorAll("[data-tomui-part=item]")).toHaveLength(2);
  });

  it("puts every item in the same group by name", () => {
    const { container } = render(() => (
      <Radio>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </Radio>
    ));

    const names = Array.from(container.querySelectorAll("[data-tomui-part=item]")).map((input) =>
      input.getAttribute("name"),
    );
    expect(names[0]).toBeTruthy();
    expect(names[0]).toBe(names[1]);
  });

  it("selects an item and reports it", () => {
    const { container } = render(() => (
      <Radio value="a" onValueChange={vi.fn()}>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </Radio>
    ));

    expect(itemOf(container).getAttribute("aria-checked")).toBe("true");
  });

  it("moves the checked state when another item is chosen", async () => {
    const { container } = render(() => (
      <Radio>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </Radio>
    ));

    const items = container.querySelectorAll<HTMLInputElement>("[data-tomui-part=item]");
    fireEvent.click(items[1]!);

    await vi.waitFor(() => {
      expect(items[0]?.getAttribute("aria-checked")).toBe("false");
      expect(items[1]?.getAttribute("aria-checked")).toBe("true");
    });
  });

  it("marks a disabled item", () => {
    const { container } = render(() => (
      <Radio disabled>
        <Radio.Item value="a" label="A" />
      </Radio>
    ));
    expect(itemOf(container).hasAttribute("disabled")).toBe(true);
  });

  it("renders an indicator next to each control", () => {
    const { container } = render(() => (
      <Radio>
        <Radio.Item value="a" label="A" />
      </Radio>
    ));
    const indicator = container.querySelector("[data-tomui-part=indicator]")!;
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
    expect(classList(indicator).length).toBeGreaterThan(0);
  });

  it("renders the card appearance with its description", () => {
    const { container } = render(() => (
      <Radio appearance="card">
        <Radio.Item value="a" label="A" description="First option" />
      </Radio>
    ));
    expect(container.textContent).toContain("First option");
    expect(
      container.querySelector("[data-tomui-part=item-label]")?.getAttribute("data-variant"),
    ).toBe("default");
  });

  it("records the error variant on the card label", () => {
    const { container } = render(() => (
      <Radio appearance="card">
        <Radio.Item value="a" label="A" variant="error" />
      </Radio>
    ));
    expect(
      container.querySelector("[data-tomui-part=item-label]")?.getAttribute("data-variant"),
    ).toBe("error");
  });

  it("gives the error variant a different ring than the default", () => {
    const { container: ok } = render(() => (
      <Radio>
        <Radio.Item value="a" label="A" />
      </Radio>
    ));
    const { container: bad } = render(() => (
      <Radio>
        <Radio.Item value="a" label="A" variant="error" />
      </Radio>
    ));
    expect(classList(itemOf(ok))).not.toEqual(classList(itemOf(bad)));
  });

  it("renders a legend and messages on the group", () => {
    const { container } = render(() => (
      <Radio legend="Pick one" error="Required" description="Choose carefully">
        <Radio.Item value="a" label="A" />
      </Radio>
    ));
    expect(container.querySelector("legend")?.textContent).toBe("Pick one");
    expect(container.textContent).toContain("Required");
    expect(container.textContent).toContain("Choose carefully");
  });
});

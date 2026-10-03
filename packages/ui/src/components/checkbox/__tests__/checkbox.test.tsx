import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../checkbox";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const inputOf = (container: HTMLElement): HTMLInputElement =>
  container.querySelector("[data-tomui-component=Checkbox][type=checkbox]")!;

describe("Checkbox", () => {
  it("renders an unchecked checkbox by default", () => {
    const { container } = render(() => <Checkbox label="Accept terms" />);
    const input = inputOf(container);
    expect(input.getAttribute("type")).toBe("checkbox");
    expect(input.getAttribute("aria-checked")).toBe("false");
  });

  it("starts checked and reports a change through onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    const { container } = render(() => (
      <Checkbox label="Subscribed" onCheckedChange={onCheckedChange} />
    ));
    const input = inputOf(container);

    fireEvent.click(input);

    await vi.waitFor(() => {
      expect(onCheckedChange).toHaveBeenCalledWith(true);
      expect(input.getAttribute("aria-checked")).toBe("true");
    });
  });

  it("honours defaultChecked", () => {
    const { container } = render(() => <Checkbox label="Subscribed" defaultChecked />);
    expect(inputOf(container).getAttribute("aria-checked")).toBe("true");
  });

  it("marks indeterminate through aria-checked and the DOM property", () => {
    const { container } = render(() => <Checkbox label="Select all" indeterminate />);
    const input = inputOf(container);
    expect(input.getAttribute("aria-checked")).toBe("mixed");
    expect(input.indeterminate).toBe(true);
  });

  it("gives the error variant a different ring than the default", () => {
    const { container: ok } = render(() => <Checkbox label="A" />);
    const { container: bad } = render(() => <Checkbox label="A" variant="error" />);
    expect(classList(inputOf(ok))).not.toEqual(classList(inputOf(bad)));
  });

  it("marks the input and label disabled", () => {
    const { container } = render(() => <Checkbox label="Accept terms" disabled />);
    const input = inputOf(container);
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.getAttribute("aria-disabled")).toBe("true");
  });

  it("reverses the layout when controlFirst is false", () => {
    const { container } = render(() => <Checkbox label="Label first" controlFirst={false} />);
    const label = container.querySelector("label[data-tomui-component=Checkbox]")!;
    expect(classList(label).length).toBeGreaterThan(0);
  });

  it("renders without a label when none is given", () => {
    const { container } = render(() => <Checkbox />);
    expect(container.querySelector("label")).toBeNull();
    expect(inputOf(container)).not.toBeNull();
  });

  it("renders a group with a legend and an error message", () => {
    const { container } = render(() => (
      <Checkbox.Group legend="Notifications" error="Pick one">
        <Checkbox.Item label="Email" value="email" />
      </Checkbox.Group>
    ));

    expect(container.querySelector("legend")?.textContent).toBe("Notifications");
    expect(container.textContent).toContain("Pick one");
  });

  it("renders an item with its label text", () => {
    const { container } = render(() => <Checkbox.Item label="Email" value="email" />);
    expect(container.textContent).toContain("Email");
  });

  it("renders the indicator next to the control as a hidden sibling", () => {
    const { container } = render(() => <Checkbox label="Accept terms" />);
    const indicator = container.querySelector("[data-tomui-part=indicator]")!;
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
    expect(indicator.previousElementSibling).toBe(inputOf(container));
  });
});

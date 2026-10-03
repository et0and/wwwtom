import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import { InputGroup } from "../input-group";

const callerStyles = stylex.create({ bordered: { borderWidth: "2px" } });

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("InputGroup", () => {
  it("renders the group and marks its parts by data-slot", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Addon>kg</InputGroup.Addon>
        <InputGroup.Input />
        <InputGroup.Suffix>per item</InputGroup.Suffix>
      </InputGroup>
    ));

    expect(container.querySelector("[data-slot=input-group]")).not.toBeNull();
    expect(container.querySelector("[data-slot=input-group-addon-start]")).not.toBeNull();
    expect(container.querySelector("[data-slot=input-group-input]")).not.toBeNull();
    expect(container.querySelector("[data-slot=input-group-suffix]")).not.toBeNull();
  });

  it("gives the input a generated id and links it to nothing by default", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Input />
      </InputGroup>
    ));
    expect(container.querySelector("input")?.id).toBeTruthy();
  });

  it("prefers an explicit id on the input", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Input id="weight" />
      </InputGroup>
    ));
    expect(container.querySelector("input")?.id).toBe("weight");
  });

  it("marks the group disabled and marks the input disabled", () => {
    const { container } = render(() => (
      <InputGroup disabled>
        <InputGroup.Input />
      </InputGroup>
    ));

    const group = container.querySelector("[data-slot=input-group]");
    expect(group?.hasAttribute("data-disabled")).toBe(true);
    expect(container.querySelector("input")?.hasAttribute("disabled")).toBe(true);
  });

  it("omits data-disabled when not disabled", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Input />
      </InputGroup>
    ));
    expect(container.querySelector("[data-slot=input-group]")?.hasAttribute("data-disabled")).toBe(
      false,
    );
  });

  it("marks the input invalid when the group has an error", () => {
    const { container } = render(() => (
      <InputGroup error="Required">
        <InputGroup.Input />
      </InputGroup>
    ));
    expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders an end-aligned addon with its own slot", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Addon align="end">kg</InputGroup.Addon>
      </InputGroup>
    ));
    expect(container.querySelector("[data-slot=input-group-addon-end]")).not.toBeNull();
    expect(container.querySelector("[data-slot=input-group-addon-start]")).toBeNull();
  });

  it("wraps the group in a Field when a label is given", () => {
    const { container } = render(() => <InputGroup label="Weight">child</InputGroup>);
    expect(container.querySelector("label")?.textContent).toBe("Weight");
  });

  it("applies a different compiled style per size", () => {
    const { container: xs } = render(() => (
      <InputGroup size="xs">
        <InputGroup.Input />
      </InputGroup>
    ));
    const { container: lg } = render(() => (
      <InputGroup size="lg">
        <InputGroup.Input />
      </InputGroup>
    ));
    expect(classList(xs.querySelector("input")!)).not.toEqual(
      classList(lg.querySelector("input")!),
    );
  });

  it("applies the caller style to the group", () => {
    const { container } = render(() => (
      <InputGroup style={callerStyles.bordered}>
        <InputGroup.Input />
      </InputGroup>
    ));
    const group = container.querySelector("[data-slot=input-group]");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("style")).toBeNull();
  });

  it("renders a group button with an accessible label from a string tooltip", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Input />
        <InputGroup.Button tooltip="Clear weight" />
      </InputGroup>
    ));
    const button = container.querySelector("[data-slot=input-group-button]");
    expect(button?.getAttribute("aria-label")).toBe("Clear weight");
    expect(button?.getAttribute("title")).toBe("Clear weight");
  });

  it("keeps an explicit aria-label over the tooltip label", () => {
    const { container } = render(() => (
      <InputGroup>
        <InputGroup.Button tooltip="Clear" aria-label="Clear the weight field" />
      </InputGroup>
    ));
    expect(
      container.querySelector("[data-slot=input-group-button]")?.getAttribute("aria-label"),
    ).toBe("Clear the weight field");
  });
});

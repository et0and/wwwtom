import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { TextInput } from "../text-input";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("TextInput", () => {
  it("renders an input and forwards native attributes", () => {
    const { container } = render(() => (
      <TextInput name="amount" placeholder="10" value="10" readonly />
    ));
    const input = container.querySelector("input")!;
    expect(input.getAttribute("name")).toBe("amount");
    expect(input.getAttribute("placeholder")).toBe("10");
    expect(input.value).toBe("10");
  });

  it("renders a leading icon and trailing slot", () => {
    const { container } = render(() => (
      <TextInput
        leadingIcon={<span data-testid="leading" />}
        trailing={<span data-testid="trailing" />}
      />
    ));
    expect(container.querySelector("[data-testid=leading]")).not.toBeNull();
    expect(container.querySelector("[data-testid=trailing]")).not.toBeNull();
  });

  it("shows invalid state to assistive technology", () => {
    const { container } = render(() => <TextInput invalid />);
    expect(container.querySelector("input")!.getAttribute("aria-invalid")).toBe("true");
    expect(
      container.querySelector("[data-tomui-component=TextInput]")!.hasAttribute("data-invalid"),
    ).toBe(true);
  });

  it("marks numeric fields", () => {
    const { container } = render(() => <TextInput numeric />);
    expect(
      container.querySelector("[data-tomui-component=TextInput]")!.hasAttribute("data-numeric"),
    ).toBe(true);
  });

  it("applies distinct styles per appearance", () => {
    const appearance = (value: "small" | "base" | "large") =>
      classList(
        render(() => <TextInput appearance={value} />).container.querySelector(
          "[data-tomui-component=TextInput]",
        )!,
      ).join(" ");

    expect(appearance("small")).not.toBe(appearance("large"));
  });

  it("does not leak the style prop onto the DOM", () => {
    const { container } = render(() => <TextInput style={undefined} />);
    expect(container.querySelector("input")!.getAttribute("style")).toBeNull();
  });
});

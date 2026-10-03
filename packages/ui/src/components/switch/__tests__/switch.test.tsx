import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Switch, switchVariants } from "../switch";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const inputOf = (container: HTMLElement): HTMLInputElement =>
  container.querySelector("[data-tomui-component=Switch][type=checkbox]")!;

describe("switchVariants", () => {
  it("gives each size a different track style", () => {
    const sm = classList(document.createElement("input"));
    expect(sm).toHaveLength(0);
    const { container: small } = render(() => <Switch size="sm" />);
    const { container: large } = render(() => <Switch size="lg" />);
    expect(classList(inputOf(small))).not.toEqual(classList(inputOf(large)));
  });

  it("returns different styles for the checked and unchecked states", () => {
    expect(switchVariants({ variant: "default" }).trackOn).not.toEqual(
      switchVariants({ variant: "default" }).trackOff,
    );
  });

  it("distinguishes the default and neutral variants", () => {
    expect(switchVariants({ variant: "default" }).trackOn).not.toEqual(
      switchVariants({ variant: "neutral" }).trackOn,
    );
  });
});

describe("Switch", () => {
  it("renders a checkbox with the switch role", () => {
    const { container } = render(() => <Switch />);
    const input = inputOf(container);
    expect(input.getAttribute("role")).toBe("switch");
    expect(input.getAttribute("type")).toBe("checkbox");
  });

  it("starts unchecked and reports a change through onCheckedChange", () => {
    const onCheckedChange = vi.fn();
    const { container } = render(() => <Switch onCheckedChange={onCheckedChange} />);
    const input = inputOf(container);

    expect(input.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(input);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("honours defaultChecked", () => {
    const { container } = render(() => <Switch defaultChecked />);
    expect(inputOf(container).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps the size prop off the DOM element", () => {
    const { container } = render(() => <Switch size="lg" />);
    const input = inputOf(container);
    expect(input.hasAttribute("size")).toBe(false);
    expect(input.getAttribute("data-size")).toBe("lg");
  });

  it("marks the input disabled and read-only", () => {
    const { container } = render(() => <Switch disabled readOnly />);
    const input = inputOf(container);
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(input.getAttribute("aria-readonly")).toBe("true");
  });

  it("reports transitioning through aria-busy", () => {
    const { container } = render(() => <Switch transitioning />);
    expect(inputOf(container).getAttribute("aria-busy")).toBe("true");
  });

  it("names the control Switch, because Field does not associate its label", () => {
    // Field renders a <label> with no `for`, and no aria-labelledby, so the
    // aria-label below is the only accessible name. It does not pick up the
    // visible label text. See the a11y note in the migration write-up.
    const { container } = render(() => <Switch label="Wi-Fi" />);
    expect(inputOf(container).getAttribute("aria-label")).toBe("Switch");
  });

  it("renders the thumb next to the track", () => {
    const { container } = render(() => <Switch />);
    const thumb = container.querySelector("[data-slot=switch-thumb]")!;
    expect(thumb.getAttribute("aria-hidden")).toBe("true");
    expect(classList(thumb).length).toBeGreaterThan(0);
  });

  it("renders a group with a legend and an error", () => {
    const { container } = render(() => (
      <Switch.Group legend="Network" error="Pick one">
        <Switch.Item label="Wi-Fi" />
      </Switch.Group>
    ));

    expect(container.querySelector("legend")?.textContent).toBe("Network");
    expect(container.textContent).toContain("Pick one");
  });

  it("renders an item with its label text", () => {
    const { container } = render(() => <Switch.Item label="Wi-Fi" />);
    expect(container.textContent).toContain("Wi-Fi");
  });
});

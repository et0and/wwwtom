import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import { Input, inputVariants } from "../input";

const callerStyles = stylex.create({ wide: { maxWidth: "40rem" } });

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("inputVariants", () => {
  it("returns a style list for the default size and variant", () => {
    expect(inputVariants().length).toBeGreaterThan(0);
  });

  it("gives each size its own compiled style", () => {
    const xs = inputVariants({ size: "xs" });
    const lg = inputVariants({ size: "lg" });
    expect(xs).not.toEqual(lg);
  });

  it("adds the error ring when the variant is error", () => {
    expect(inputVariants({ variant: "error" })).not.toEqual(inputVariants());
  });

  it("keeps the focus ring when focusIndicator is set", () => {
    expect(inputVariants({ focusIndicator: true })).not.toEqual(inputVariants());
  });
});

describe("Input", () => {
  it("renders a bare input when no label, description, or error is given", () => {
    const { container } = render(() => <Input />);
    expect(container.querySelector("input")).not.toBeNull();
    expect(container.querySelector("label")).toBeNull();
  });

  it("wraps the input in a Field when a label is given", () => {
    const { container } = render(() => <Input label="Email" />);
    expect(container.querySelector("label")?.textContent).toBe("Email");
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("associates the label with the input via a matching for/id pair", () => {
    const { container } = render(() => <Input label="Email" />);
    const label = container.querySelector("label")!;
    const input = container.querySelector("input")!;
    expect(input.id).toBeTruthy();
    expect(label.getAttribute("for")).toBe(input.id);
  });

  it("keeps a caller-supplied id as the control id the label points to", () => {
    const { container } = render(() => <Input label="Email" id="email-field" />);
    const label = container.querySelector("label")!;
    const input = container.querySelector("input")!;
    expect(input.id).toBe("email-field");
    expect(label.getAttribute("for")).toBe("email-field");
  });

  it("marks the input invalid when an error is given", () => {
    const { container } = render(() => <Input error="Required" />);
    expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
  });

  it("adds the password manager attributes when passwordManagerIgnore is set", () => {
    const { container } = render(() => <Input passwordManagerIgnore />);
    const input = container.querySelector("input");
    expect(input?.getAttribute("data-1p-ignore")).toBe("true");
    expect(input?.getAttribute("data-bwignore")).toBe("true");
    expect(input?.getAttribute("data-form-type")).toBe("other");
    expect(input?.getAttribute("data-lpignore")).toBe("true");
  });

  it("omits the password manager attributes by default", () => {
    const { container } = render(() => <Input />);
    const input = container.querySelector("input");
    expect(input?.hasAttribute("data-1p-ignore")).toBe(false);
    expect(input?.hasAttribute("data-form-type")).toBe(false);
  });

  it("applies the caller style last so it wins", () => {
    const { container } = render(() => <Input style={callerStyles.wide} />);
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(classList(input!).length).toBeGreaterThan(0);
  });

  it("does not leak the style prop onto the DOM as an attribute", () => {
    const { container } = render(() => <Input style={callerStyles.wide} />);
    const input = container.querySelector("input");
    expect(input?.getAttribute("style")).toBeNull();
  });

  it("forwards native attributes to the input", () => {
    const { container } = render(() => <Input name="email" placeholder="you@example.com" />);
    const input = container.querySelector("input");
    expect(input?.getAttribute("name")).toBe("email");
    expect(input?.getAttribute("placeholder")).toBe("you@example.com");
  });

  it("marks required inputs so the Field can show the marker", () => {
    const { container } = render(() => <Input label="Email" required />);
    expect(container.textContent).toContain("Email");
  });
});

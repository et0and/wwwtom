import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import { Field, normalizeFieldError } from "../field";

const callerStyles = stylex.create({ wide: { maxWidth: "40rem" } });

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("normalizeFieldError", () => {
  it("returns undefined for no error or an empty string", () => {
    expect(normalizeFieldError(undefined)).toBeUndefined();
    expect(normalizeFieldError("")).toBeUndefined();
  });

  it("wraps a plain string with match: true", () => {
    expect(normalizeFieldError("Required")).toEqual({ message: "Required", match: true });
  });

  it("passes an already-structured error through unchanged", () => {
    const error = { message: "Bad", match: "valueMissing" as const };
    expect(normalizeFieldError(error)).toBe(error);
  });
});

describe("Field", () => {
  it("renders the label when one is given", () => {
    const { container } = render(() => <Field label="Email">control</Field>);
    expect(container.textContent).toContain("Email");
    expect(container.querySelector("label")).not.toBeNull();
  });

  it("hides the label but keeps it out of the DOM when hideLabel is set", () => {
    const { container } = render(() => (
      <Field label="Email" hideLabel>
        control
      </Field>
    ));

    expect(container.textContent).not.toContain("Email");
    expect(container.querySelector("label")).toBeNull();
  });

  it("shows the description when there is no error", () => {
    const { container } = render(() => (
      <Field label="Email" description="We never share it.">
        control
      </Field>
    ));

    expect(container.textContent).toContain("We never share it.");
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  it("shows the error in an alert, replacing the description", () => {
    const { container } = render(() => (
      <Field label="Email" description="We never share it." error="Required">
        control
      </Field>
    ));

    const alert = container.querySelector("[role=alert]")!;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Required");
    expect(container.textContent).not.toContain("We never share it.");
  });

  it("prefers the error over the description", () => {
    const { container } = render(() => (
      <Field description="Helper" error="Broken">
        control
      </Field>
    ));

    expect(container.textContent).toContain("Broken");
    expect(container.textContent).not.toContain("Helper");
  });

  it("renders the children control", () => {
    const { container } = render(() => (
      <Field label="Email">
        <input type="text" />
      </Field>
    ));

    expect(container.querySelector("input")).not.toBeNull();
  });

  it("gives the label a generated for id when none is supplied", () => {
    const { container } = render(() => (
      <Field label="Email">
        <input type="text" />
      </Field>
    ));

    expect(container.querySelector("label")?.getAttribute("for")).toBeTruthy();
  });

  it("lets a caller-supplied controlId win over the generated one", () => {
    const { container } = render(() => (
      <Field label="Email" controlId="custom-email-id">
        <input type="text" id="custom-email-id" />
      </Field>
    ));

    const label = container.querySelector("label")!;
    expect(label.getAttribute("for")).toBe("custom-email-id");
  });

  it("applies distinct styling when controlFirst is set", () => {
    const normal = classList(
      render(() => <Field label="a">x</Field>).container.querySelector(
        "[data-tomui-component=Field]",
      )!,
    );
    const reversed = classList(
      render(() => (
        <Field label="a" controlFirst>
          x
        </Field>
      )).container.querySelector("[data-tomui-component=Field]")!,
    );

    expect(reversed).not.toEqual(normal);
  });

  it("applies base styling either way", () => {
    const { container } = render(() => <Field label="a">x</Field>);
    expect(
      classList(container.querySelector("[data-tomui-component=Field]")!).length,
    ).toBeGreaterThan(0);
  });

  it("merges caller styles", () => {
    const plain = classList(
      render(() => <Field label="a">x</Field>).container.querySelector(
        "[data-tomui-component=Field]",
      )!,
    );
    const overridden = classList(
      render(() => (
        <Field label="a" style={callerStyles.wide}>
          x
        </Field>
      )).container.querySelector("[data-tomui-component=Field]")!,
    );

    expect(overridden.filter((token) => !plain.includes(token)).length).toBeGreaterThan(0);
  });
});

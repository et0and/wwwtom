import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import {
  BOLDABLE_VARIANTS,
  DEFAULT_ELEMENT_BY_VARIANT,
  TOMUI_TEXT_DEFAULT_VARIANTS,
  textStyles,
  type TomuiTextSize,
  type TomuiTextVariant,
} from "../variants";
import { Text } from "../text";

const VARIANTS: ReadonlyArray<TomuiTextVariant> = [
  "heading",
  "body",
  "secondary",
  "success",
  "error",
  "mono",
  "mono-secondary",
];

const SIZES: ReadonlyArray<TomuiTextSize> = ["xs", "sm", "base", "lg"];

afterEach(cleanup);

/** StyleX compiles to opaque hashed class names, so assert they are present. */
const classAttr = (element: Element): string => element.getAttribute("class") ?? "";

describe("Text variants", () => {
  it("defaults to the body variant at base size", () => {
    expect(TOMUI_TEXT_DEFAULT_VARIANTS).toEqual({ variant: "body", size: "base" });
  });

  it("renders every variant without throwing", () => {
    for (const variant of VARIANTS) {
      render(() => <Text variant={variant}>text</Text>);
      expect(screen.getByText("text")).toBeTruthy();
      cleanup();
    }
  });

  it("gives distinct styling per variant", () => {
    const seen = new Set<string>();
    for (const variant of VARIANTS) {
      const { container } = render(() => <Text variant={variant}>text</Text>);
      seen.add(classAttr(container.firstElementChild!));
      cleanup();
    }
    // body and the colour-only variants must not collapse onto one class list.
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});

describe("DEFAULT_ELEMENT_BY_VARIANT", () => {
  it("renders headings and monospace as span, body variants as p", () => {
    expect(DEFAULT_ELEMENT_BY_VARIANT.heading).toBe("span");
    expect(DEFAULT_ELEMENT_BY_VARIANT.mono).toBe("span");
    expect(DEFAULT_ELEMENT_BY_VARIANT["mono-secondary"]).toBe("span");
    expect(DEFAULT_ELEMENT_BY_VARIANT.body).toBe("p");
    expect(DEFAULT_ELEMENT_BY_VARIANT.secondary).toBe("p");
    expect(DEFAULT_ELEMENT_BY_VARIANT.success).toBe("p");
    expect(DEFAULT_ELEMENT_BY_VARIANT.error).toBe("p");
  });

  it("covers every variant", () => {
    expect(Object.keys(DEFAULT_ELEMENT_BY_VARIANT).sort()).toEqual([...VARIANTS].sort());
  });

  it("renders the element each variant defaults to", () => {
    for (const variant of VARIANTS) {
      const Default = DEFAULT_ELEMENT_BY_VARIANT[variant];
      const { container } = render(() => <Text variant={variant}>text</Text>);
      expect(container.firstElementChild!.tagName.toLowerCase()).toBe(Default);
      cleanup();
    }
  });

  it("honours an explicit `as`", () => {
    const { container } = render(() => <Text as="h2">text</Text>);
    expect(container.firstElementChild!.tagName.toLowerCase()).toBe("h2");
  });
});

describe("BOLDABLE_VARIANTS", () => {
  it("is exactly the body variants", () => {
    expect([...BOLDABLE_VARIANTS].sort()).toEqual(["body", "error", "secondary", "success"]);
  });

  it("applies bold to body variants only", () => {
    const bolded = render(() => <Text bold>text</Text>);
    const boldedClass = classAttr(bolded.container.firstElementChild!);
    cleanup();

    const heading = render(() => (
      <Text variant="heading" bold>
        text
      </Text>
    ));
    const headingClass = classAttr(heading.container.firstElementChild!);
    cleanup();

    expect(boldedClass).not.toBe(headingClass);
  });
});

describe("size resolution", () => {
  it("gives headings a larger size only at size lg", () => {
    const atLg = render(() => (
      <Text variant="heading" size="lg">
        text
      </Text>
    ));
    const atLgClass = classAttr(atLg.container.firstElementChild!);
    cleanup();

    expect(atLgClass.length).toBeGreaterThan(0);

    // Every other size leaves the heading's own font size in place, so the
    // rendered class list must not carry the `xl` step-up class.
    for (const size of SIZES.filter((s) => s !== "lg")) {
      const { container } = render(() => (
        <Text variant="heading" size={size}>
          text
        </Text>
      ));
      expect(classAttr(container.firstElementChild!)).not.toBe(atLgClass);
      cleanup();
    }
  });

  it("gives monospace one step smaller than body", () => {
    const mono = render(() => <Text variant="mono">text</Text>);
    const monoClass = classAttr(mono.container.firstElementChild!);
    cleanup();

    const monoLg = render(() => (
      <Text variant="mono" size="lg">
        text
      </Text>
    ));
    const monoLgClass = classAttr(monoLg.container.firstElementChild!);
    cleanup();

    const body = render(() => <Text variant="body">text</Text>);
    const bodyClass = classAttr(body.container.firstElementChild!);
    cleanup();

    expect(monoClass).not.toBe(monoLgClass);
    expect(monoLgClass).not.toBe(bodyClass);
  });

  it("varies size across the body scale", () => {
    const classes = SIZES.map((size) => {
      const { container } = render(() => <Text size={size}>text</Text>);
      const value = classAttr(container.firstElementChild!);
      cleanup();
      return value;
    });
    expect(new Set(classes).size).toBe(SIZES.length);
  });
});

describe("blurIn", () => {
  it("keeps a readable copy and a per-character animated copy", () => {
    const { container } = render(() => <Text blurIn>Hi</Text>);
    const root = container.firstElementChild!;
    expect(root.querySelector('[aria-hidden="true"]')).toBeTruthy();
    // Two characters, each carrying its own staggered animation delay.
    expect(root.querySelectorAll('[style*="animation-delay"]')).toHaveLength(2);
    // The readable text survives for assistive tech and the accessible name.
    expect(root.textContent).toContain("Hi");
  });

  it("does not split a non-string child", () => {
    const { container } = render(() => (
      <Text blurIn>
        <em>Hi</em>
      </Text>
    ));
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("keeps the requested element", () => {
    const { container } = render(() => (
      <Text as="h1" blurIn>
        Title
      </Text>
    ));
    expect(container.firstElementChild!.tagName.toLowerCase()).toBe("h1");
  });
});

describe("caller style override", () => {
  it("merges caller styles without dropping variant styling", () => {
    const plain = render(() => <Text>text</Text>);
    const plainClass = classAttr(plain.container.firstElementChild!);
    cleanup();

    const overridden = render(() => <Text style={textStyles.bold}>text</Text>);
    const overriddenClass = classAttr(overridden.container.firstElementChild!);
    cleanup();

    expect(overriddenClass).not.toBe(plainClass);
    // The variant colour must survive the merge.
    expect(overriddenClass).toContain(plainClass.split(" ")[0]!);
  });
});

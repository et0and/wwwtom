import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as stylex from "@stylexjs/stylex";
import { Button, LinkButton, buttonVariants } from "../button";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * StyleX compiles to opaque hashed class names and jsdom loads no stylesheet,
 * so these assert on observable output: the class list, the `style` attribute,
 * and behaviour. They deliberately avoid asserting a specific hash, which
 * would break on any unrelated style change.
 */
/**
 * A caller style. StyleX only accepts compiled styles from `stylex.create`, so
 * a caller cannot pass an inline object literal.
 */
const callerStyles = stylex.create({ override: { outlineWidth: "3px" } });

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("Button", () => {
  it("renders a button element with the default type", () => {
    const { container } = render(() => <Button>Save</Button>);
    const button = container.querySelector("button")!;

    expect(button.getAttribute("type")).toBe("button");
    expect(button.dataset.tomuiComponent).toBe("Button");
    expect(button.textContent).toBe("Save");
  });

  it("applies a distinct rule set per visual variant", () => {
    // `primary` and `destructive` deliberately share one rule; they differ by
    // the accent custom properties, not by class list.
    const distinct = ["primary", "secondary", "ghost", "secondary-destructive", "outline"] as const;
    const seen = new Set<string>();

    for (const variant of distinct) {
      const { container } = render(() => <Button variant={variant}>x</Button>);
      seen.add(classList(container.querySelector("button")!).join(" "));
    }

    expect(seen.size).toBe(distinct.length);
  });

  it("gives primary and destructive different accent colours", () => {
    const accentOf = (variant: "primary" | "destructive") => {
      const { container } = render(() => <Button variant={variant}>x</Button>);
      return container.querySelector("button")!.getAttribute("style") ?? "";
    };

    const primary = accentOf("primary");
    const destructive = accentOf("destructive");

    expect(primary).not.toBe("");
    expect(destructive).not.toBe("");
    // Brand blue versus danger red.
    expect(primary).not.toBe(destructive);
    expect(primary).toContain("--color-tomui-brand");
    expect(destructive).toContain("--color-tomui-danger");
  });

  it("applies distinct styles per size", () => {
    const seen = new Set<string>();
    for (const size of ["xs", "sm", "base", "lg"] as const) {
      const { container } = render(() => <Button size={size}>x</Button>);
      seen.add(classList(container.querySelector("button")!).join(" "));
    }
    expect(seen.size).toBe(4);
  });

  it("square and circle forms differ from the base form", () => {
    const renderForm = (form: "base" | "square" | "circle") =>
      classList(render(() => <Button form={form}>x</Button>).container.querySelector("button")!);

    // square centres its content and drops padding; circle adds a full radius.
    expect(renderForm("square")).not.toEqual(renderForm("base"));
    expect(renderForm("circle")).not.toEqual(renderForm("base"));
    expect(renderForm("circle")).not.toEqual(renderForm("square"));
  });

  it("sets the accent custom properties for emphasis variants", () => {
    const { container } = render(() => <Button variant="primary">x</Button>);
    const style = container.querySelector("button")!.getAttribute("style") ?? "";

    expect(style).toContain("--x");
    expect(style).toContain("color-mix");
  });

  it("sets no accent custom properties for plain variants", () => {
    const { container } = render(() => <Button variant="secondary">x</Button>);
    expect(container.querySelector("button")!.getAttribute("style")).toBeNull();
  });

  it("renders the gradient overlay only for emphasis variants", () => {
    const emphasis = render(() => <Button variant="primary">x</Button>);
    expect(emphasis.container.querySelectorAll("span").length).toBeGreaterThan(1);
    expect(emphasis.container.querySelector("button")!.hasAttribute("style")).toBe(true);

    const plain = render(() => <Button variant="secondary">x</Button>);
    expect(plain.container.querySelector("button")!.hasAttribute("style")).toBe(false);
  });

  it("shows a loader and disables while loading", () => {
    const { container, queryByRole } = render(() => <Button loading>Save</Button>);
    const button = container.querySelector("button")!;

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(queryByRole("status")).not.toBeNull();
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    const { container } = render(() => <Button onClick={onClick}>Save</Button>);

    fireEvent.click(container.querySelector("button")!);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("merges caller styles and lets them win on conflict", () => {
    const plain = render(() => <Button variant="secondary">x</Button>).container.querySelector(
      "button",
    )!;
    const overridden = render(() => (
      <Button variant="secondary" style={callerStyles.override}>
        x
      </Button>
    )).container.querySelector("button")!;

    const plainClasses = classList(plain);
    const overriddenClasses = classList(overridden);

    // The caller style adds its own class.
    const added = overriddenClasses.filter((token) => !plainClasses.includes(token));
    expect(added).toHaveLength(1);

    // The base rule it conflicts with (outlineWidth: 0) is replaced, so exactly
    // one class drops out. Every other rule survives, so variant colour and
    // sizing still apply.
    const removed = plainClasses.filter((token) => !overriddenClasses.includes(token));
    expect(removed).toHaveLength(1);
  });

  it("forwards native button attributes", () => {
    const { container } = render(() => (
      <Button type="submit" title="Submit the form" aria-label="Save changes">
        Save
      </Button>
    ));
    const button = container.querySelector("button")!;

    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("title")).toBe("Submit the form");
    expect(button.getAttribute("aria-label")).toBe("Save changes");
  });

  it("renders the icon alongside the label", () => {
    const { container } = render(() => <Button icon={<span data-testid="icon" />}>Save</Button>);

    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull();
    expect(container.textContent).toContain("Save");
  });
});

describe("buttonVariants", () => {
  it("returns a style list for the default combination", () => {
    expect(buttonVariants({})).toBeInstanceOf(Array);
    expect(buttonVariants({}).length).toBeGreaterThan(0);
  });

  it("varies with the requested variant", () => {
    expect(buttonVariants({ variant: "primary" })).not.toBe(buttonVariants({ variant: "ghost" }));
  });
});

describe("LinkButton", () => {
  it("renders an anchor when enabled", () => {
    const { container } = render(() => <LinkButton href="/docs">Docs</LinkButton>);
    const anchor = container.querySelector("a")!;

    expect(anchor.getAttribute("href")).toBe("/docs");
    expect(anchor.textContent).toBe("Docs");
  });

  it("renders a disabled button instead of an anchor", () => {
    const { container } = render(() => (
      <LinkButton href="/docs" disabled>
        Docs
      </LinkButton>
    ));

    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("button")!.hasAttribute("disabled")).toBe(true);
  });

  it("adds rel and target only for external links", () => {
    const internal = render(() => <LinkButton href="/docs">Docs</LinkButton>);
    expect(internal.container.querySelector("a")!.getAttribute("target")).toBeNull();

    const external = render(() => (
      <LinkButton href="https://example.com" external>
        Site
      </LinkButton>
    ));
    const anchor = external.container.querySelector("a")!;
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

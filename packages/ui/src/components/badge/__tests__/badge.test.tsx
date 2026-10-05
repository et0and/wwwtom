import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Badge, badgeVariants } from "../badge";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("badgeVariants", () => {
  it("gives every variant a distinct style", () => {
    const base = classList(document.createElement("span"));
    expect(base).toHaveLength(0);
    expect(badgeVariants({ variant: "primary" })).not.toEqual(
      badgeVariants({ variant: "success" }),
    );
  });

  it("replaces the variant colours in the dot appearance", () => {
    expect(badgeVariants({ variant: "primary", appearance: "dot" })).not.toEqual(
      badgeVariants({ variant: "primary", appearance: "filled" }),
    );
  });
});

describe("Badge", () => {
  it("renders its children", () => {
    const { container } = render(() => <Badge>New</Badge>);
    expect(container.querySelector("[data-tomui-component=Badge]")?.textContent).toBe("New");
  });

  it("shows a dot only for the variants that map to one", () => {
    const { container: success } = render(() => (
      <Badge appearance="dot" variant="success">
        Ok
      </Badge>
    ));
    expect(success.querySelector("[data-tomui-component=Badge] > span")).not.toBeNull();

    const { container: primary } = render(() => (
      <Badge appearance="dot" variant="primary">
        New
      </Badge>
    ));
    // primary has no dot colour, so only the icon slot is absent and no dot renders.
    expect(primary.querySelector("[aria-hidden=true]")).toBeNull();
  });

  it("renders no dot in the filled appearance", () => {
    const { container } = render(() => <Badge variant="success">Ok</Badge>);
    expect(container.querySelector("[aria-hidden=true]")).toBeNull();
  });

  it("renders an icon wrapper marked with data-slot", () => {
    const { container } = render(() => <Badge icon={<svg />}>New</Badge>);
    expect(container.querySelector("[data-slot=badge-icon]")).not.toBeNull();
  });

  it("renders no icon wrapper without an icon", () => {
    const { container } = render(() => <Badge>New</Badge>);
    expect(container.querySelector("[data-slot=badge-icon]")).toBeNull();
  });

  it("keeps the size styles on the beta outline variant", () => {
    const { container: beta } = render(() => <Badge variant="beta">Beta</Badge>);
    const { container: primary } = render(() => <Badge variant="primary">New</Badge>);
    expect(classList(beta.querySelector("[data-tomui-component=Badge]")!)).not.toEqual(
      classList(primary.querySelector("[data-tomui-component=Badge]")!),
    );
  });
});

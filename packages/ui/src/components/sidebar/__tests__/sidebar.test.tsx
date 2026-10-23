import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Sidebar, sidebarVariants, SidebarItem, SidebarSection } from "../sidebar";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("sidebarVariants", () => {
  it("gives the sidebar and floating variants a different style", () => {
    expect(sidebarVariants({ variant: "sidebar" })).not.toEqual(
      sidebarVariants({ variant: "floating" }),
    );
  });

  it("gives left and right sides a different style for the sidebar variant", () => {
    expect(sidebarVariants({ variant: "sidebar", side: "left" })).not.toEqual(
      sidebarVariants({ variant: "sidebar", side: "right" }),
    );
  });
});

describe("Sidebar", () => {
  it("starts expanded by default", () => {
    const { container } = render(() => <Sidebar>Content</Sidebar>);
    expect(
      container.querySelector("[data-tomui-component=Sidebar]")?.getAttribute("data-state"),
    ).toBe("expanded");
  });

  it("collapses when the trigger is clicked", async () => {
    const { container } = render(() => <Sidebar>Content</Sidebar>);
    const trigger = container.querySelector("button")!;
    fireEvent.click(trigger);
    await vi.waitFor(() => {
      expect(
        container.querySelector("[data-tomui-component=Sidebar]")?.getAttribute("data-state"),
      ).toBe("collapsed");
    });
  });

  it("hides the trigger when collapsible is none", () => {
    const { container } = render(() => <Sidebar collapsible="none">Content</Sidebar>);
    expect(container.querySelector("button")).toBeNull();
  });

  it("gives a collapsed sidebar a different class list", async () => {
    const { container } = render(() => <Sidebar>Content</Sidebar>);
    const before = classList(container.querySelector("[data-tomui-component=Sidebar]")!);
    fireEvent.click(container.querySelector("button")!);
    await vi.waitFor(() => {
      const after = classList(container.querySelector("[data-tomui-component=Sidebar]")!);
      expect(after).not.toEqual(before);
    });
  });
});

describe("SidebarSection", () => {
  it("renders its items while expanded", () => {
    const { container } = render(() => (
      <SidebarSection label="Group">
        <SidebarItem href="#">Item</SidebarItem>
      </SidebarSection>
    ));
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.textContent).toContain("Item");
  });

  it("hides its items when collapsed via the label button", async () => {
    const { container } = render(() => (
      <SidebarSection label="Group">
        <SidebarItem href="#">Item</SidebarItem>
      </SidebarSection>
    ));
    fireEvent.click(container.querySelector("button")!);
    await vi.waitFor(() => expect(container.querySelector("ul")).toBeNull());
  });
});

describe("SidebarItem", () => {
  it("marks the active item with aria-current", () => {
    const { container } = render(() => (
      <SidebarItem href="#" active>
        Item
      </SidebarItem>
    ));
    expect(container.querySelector("a")?.getAttribute("aria-current")).toBe("page");
  });

  it("leaves aria-current unset when inactive", () => {
    const { container } = render(() => <SidebarItem href="#">Item</SidebarItem>);
    expect(container.querySelector("a")?.hasAttribute("aria-current")).toBe(false);
  });
});

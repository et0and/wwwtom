import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Collapsible } from "../collapsible";

describe("Collapsible", () => {
  it("renders the trigger and hides the panel while closed", () => {
    const { container } = render(() => (
      <Collapsible>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Details</Collapsible.Panel>
      </Collapsible>
    ));
    expect(
      container.querySelector("[data-tomui-part=trigger]")?.getAttribute("aria-expanded"),
    ).toBe("false");
    expect(container.querySelector("[data-tomui-part=panel]")).toBeNull();
  });

  it("shows the panel once opened", async () => {
    const { container } = render(() => (
      <Collapsible defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Details</Collapsible.Panel>
      </Collapsible>
    ));
    await vi.waitFor(() => {
      expect(container.querySelector("[data-tomui-part=panel]")?.textContent).toBe("Details");
    });
  });

  it("toggles open state on trigger click", async () => {
    const { container } = render(() => (
      <Collapsible>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Details</Collapsible.Panel>
      </Collapsible>
    ));
    const trigger = container.querySelector("[data-tomui-part=trigger]")!;
    fireEvent.click(trigger);

    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector("[data-tomui-part=panel]")).not.toBeNull();
    });
  });

  it("keeps a keepMounted panel in the DOM and toggles hidden instead", async () => {
    const { container } = render(() => (
      <Collapsible>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Details</Collapsible.Panel>
      </Collapsible>
    ));
    const panel = container.querySelector("[data-tomui-part=panel]")!;
    expect(panel.hasAttribute("hidden")).toBe(true);

    fireEvent.click(container.querySelector("[data-tomui-part=trigger]")!);

    await vi.waitFor(() => {
      expect(panel.hasAttribute("hidden")).toBe(false);
    });
  });

  it("reports open changes to the caller", async () => {
    const onOpenChange = vi.fn();
    const { container } = render(() => (
      <Collapsible onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Details</Collapsible.Panel>
      </Collapsible>
    ));
    fireEvent.click(container.querySelector("[data-tomui-part=trigger]")!);

    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });

  it("rotates the default trigger's icon and reveals the default panel once open", async () => {
    const { container } = render(() => (
      <Collapsible>
        <Collapsible.DefaultTrigger>Project details</Collapsible.DefaultTrigger>
        <Collapsible.DefaultPanel>Repository settings live here.</Collapsible.DefaultPanel>
      </Collapsible>
    ));
    const trigger = container.querySelector("[data-tomui-part=default-trigger]")!;
    const icon = trigger.querySelector("svg")!;
    const closedClass = icon.getAttribute("class");
    expect(container.textContent).not.toContain("Repository settings live here.");

    fireEvent.click(trigger);

    await vi.waitFor(() => {
      expect(trigger.getAttribute("data-panel-open")).toBe("");
      expect(icon.getAttribute("class")).not.toBe(closedClass);
      expect(container.textContent).toContain("Repository settings live here.");
    });
  });
});

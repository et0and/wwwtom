import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabsObj } from "../tabs";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "posts", label: "Posts" },
];

describe("Tabs", () => {
  it("renders a tablist with a tab per item", () => {
    const { container } = render(() => <Tabs tabs={tabs} value="overview" />);
    expect(container.querySelector("[role=tablist]")).not.toBeNull();
    expect(container.querySelectorAll("[role=tab]")).toHaveLength(2);
  });

  it("marks the active tab with aria-selected", () => {
    const { container } = render(() => <Tabs tabs={tabs} value="posts" />);
    const selected = container.querySelector('[data-value="posts"]')!;
    const other = container.querySelector('[data-value="overview"]')!;
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(other.getAttribute("aria-selected")).toBe("false");
  });

  it("selects a tab on click and reports it through onValueChange", async () => {
    const onValueChange = vi.fn();
    const { container } = render(() => (
      <Tabs tabs={tabs} value="overview" onValueChange={onValueChange} />
    ));
    const target = container.querySelector('[data-value="posts"]')!;
    fireEvent.click(target);

    await vi.waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith("posts");
    });
  });

  it("keeps the tomui-tabs-list marker class alongside its generated styles", () => {
    const { container } = render(() => <Tabs tabs={tabs} value="overview" />);
    const list = container.querySelector("[role=tablist]")!;
    expect(classList(list)).toContain("tomui-tabs-list");
    expect(classList(list).length).toBeGreaterThan(1);
  });

  it("gives the segmented and underline variants different tab styling", () => {
    const { container: segmented } = render(() => (
      <Tabs tabs={tabs} value="overview" variant="segmented" />
    ));
    const { container: underline } = render(() => (
      <Tabs tabs={tabs} value="overview" variant="underline" />
    ));
    const segmentedTab = segmented.querySelector("[role=tab]")!;
    const underlineTab = underline.querySelector("[role=tab]")!;
    expect(classList(segmentedTab)).not.toEqual(classList(underlineTab));
  });

  it("disables a tab item", () => {
    const { container } = render(() => (
      <Tabs tabs={[...tabs, { value: "archived", label: "Archived", disabled: true }]} />
    ));
    const archived = container.querySelector('[data-value="archived"]')!;
    expect(archived.hasAttribute("disabled")).toBe(true);
  });

  it("renders nothing when there are no tabs", () => {
    const { container } = render(() => <Tabs tabs={[]} />);
    expect(container.querySelector("[role=tablist]")).toBeNull();
  });

  it("moves focus with arrow keys", () => {
    const { container } = render(() => <Tabs tabs={tabs} value="overview" />);
    const list = container.querySelector("[role=tablist]")! as HTMLElement;
    const first = container.querySelector('[data-value="overview"]') as HTMLElement;
    const second = container.querySelector('[data-value="posts"]') as HTMLElement;
    first.focus();
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
  });

  it("renders only the active TabsObj.Content panel", () => {
    const { container } = render(() => (
      <TabsObj tabs={tabs} value="overview">
        <TabsObj.Content value="overview">Overview body</TabsObj.Content>
        <TabsObj.Content value="posts">Posts body</TabsObj.Content>
      </TabsObj>
    ));
    expect(container.textContent).toContain("Overview body");
    expect(container.textContent).not.toContain("Posts body");
    expect(container.querySelectorAll("[data-tomui-part=panel]")).toHaveLength(1);
  });

  it("keeps a forceMount panel in the DOM but hidden when inactive", () => {
    const { container } = render(() => (
      <TabsObj tabs={tabs} value="overview">
        <TabsObj.Content value="posts" forceMount>
          Posts body
        </TabsObj.Content>
      </TabsObj>
    ));
    const panel = container.querySelector("[data-tomui-part=panel]")!;
    expect(panel.hasAttribute("hidden")).toBe(true);
  });
});

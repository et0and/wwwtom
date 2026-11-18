import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "../dropdown";

describe("DropdownMenu", () => {
  it("does not report a close for clicks and keys after the menu closed", async () => {
    const onOpenChange = vi.fn();
    const { container } = render(() => (
      <DropdownMenu defaultOpen onOpenChange={onOpenChange}>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>One</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    ));

    fireEvent.click(container.querySelector("[data-tomui-part=trigger]")!);
    await vi.waitFor(() => expect(container.querySelector("[data-tomui-part=content]")).toBeNull());

    onOpenChange.mockClear();
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

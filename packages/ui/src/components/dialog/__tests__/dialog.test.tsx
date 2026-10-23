import { fireEvent, render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "../dialog";

afterEach(() => {
  vi.restoreAllMocks();
});

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const openDialog = () =>
  render(() => (
    <Dialog.Root defaultOpen>
      <Dialog>
        <Dialog.Title>Title</Dialog.Title>
        <Dialog.Description>Body</Dialog.Description>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog>
    </Dialog.Root>
  ));

describe("Dialog", () => {
  it("renders nothing until opened", () => {
    const { container } = render(() => (
      <Dialog.Root>
        <Dialog>hidden</Dialog>
      </Dialog.Root>
    ));

    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("renders the panel when opened by default", () => {
    const { container } = openDialog();
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
  });

  it("marks the panel as a modal and wires its labels", () => {
    const { container } = openDialog();
    const panel = container.querySelector("[role=dialog]")!;

    expect(panel.getAttribute("aria-modal")).toBe("true");
    const titleId = panel.getAttribute("aria-labelledby");
    const descriptionId = panel.getAttribute("aria-describedby");

    expect(titleId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    // The title and description carry the ids the panel points at.
    expect(container.querySelector("[data-tomui-part=title]")!.id).toBe(titleId);
    expect(container.querySelector("[data-tomui-part=description]")!.id).toBe(descriptionId);
  });

  it("uses the alertdialog role when asked", () => {
    const { container } = render(() => (
      <Dialog.Root defaultOpen role="alertdialog">
        <Dialog>body</Dialog>
      </Dialog.Root>
    ));

    expect(container.querySelector("[role=alertdialog]")).not.toBeNull();
  });

  it("toggles from the trigger", async () => {
    const { container } = render(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog>body</Dialog>
      </Dialog.Root>
    ));
    const trigger = container.querySelector("[data-tomui-part=trigger]")!;

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[role=dialog]")).toBeNull();

    fireEvent.click(trigger);

    // Solid 2.0 writes flush asynchronously.
    await vi.waitFor(() => {
      expect(container.querySelector("[role=dialog]")).not.toBeNull();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes from the close button", async () => {
    const { container } = openDialog();

    fireEvent.click(container.querySelector("[data-tomui-part=close]")!);

    await vi.waitFor(() => {
      expect(container.querySelector("[role=dialog]")).toBeNull();
    });
  });

  it("notifies onOpenChange when toggled", async () => {
    const onOpenChange = vi.fn();
    const { container } = render(() => (
      <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog>
      </Dialog.Root>
    ));

    fireEvent.click(container.querySelector("[data-tomui-part=close]")!);

    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("applies a distinct style per size", () => {
    const panelFor = (size: "sm" | "base" | "lg" | "xl") =>
      classList(
        render(() => (
          <Dialog.Root defaultOpen>
            <Dialog size={size}>x</Dialog>
          </Dialog.Root>
        )).container.querySelector("[role=dialog]")!,
      ).join(" ");

    const sizes = (["sm", "base", "lg", "xl"] as const).map(panelFor);
    expect(new Set(sizes).size).toBe(4);
  });

  it("gives the full surface its own layout, distinct from every size", () => {
    const full = classList(
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog surface="full">x</Dialog>
        </Dialog.Root>
      )).container.querySelector("[role=dialog]")!,
    ).join(" ");

    for (const size of ["sm", "base", "lg", "xl"] as const) {
      const sized = classList(
        render(() => (
          <Dialog.Root defaultOpen>
            <Dialog size={size}>x</Dialog>
          </Dialog.Root>
        )).container.querySelector("[role=dialog]")!,
      ).join(" ");
      expect(full).not.toBe(sized);
    }
  });

  it("closes on backdrop click for a dialog but not an alertdialog", async () => {
    const dialog = openDialog();
    fireEvent.click(dialog.container.querySelector("[data-tomui-part=backdrop]")!);
    await vi.waitFor(() => {
      expect(dialog.container.querySelector("[role=dialog]")).toBeNull();
    });

    const alert = render(() => (
      <Dialog.Root defaultOpen role="alertdialog">
        <Dialog>body</Dialog>
      </Dialog.Root>
    ));
    fireEvent.click(alert.container.querySelector("[data-tomui-part=backdrop]")!);
    expect(alert.container.querySelector("[role=alertdialog]")).not.toBeNull();
  });

  it("merges caller styles", () => {
    const plain = classList(
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog>x</Dialog>
        </Dialog.Root>
      )).container.querySelector("[role=dialog]")!,
    );
    const overridden = classList(
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog style={callerStyles.wide}>x</Dialog>
        </Dialog.Root>
      )).container.querySelector("[role=dialog]")!,
    );

    expect(overridden.filter((token) => !plain.includes(token)).length).toBeGreaterThan(0);
  });
});

const callerStyles = stylex.create({ wide: { minHeight: "50vh" } });

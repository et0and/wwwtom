import { fireEvent, render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createToastStore, toastVariants, Toaster } from "../toast";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("toastVariants", () => {
  it("gives every variant a distinct style", () => {
    expect(toastVariants({ variant: "default" })).not.toEqual(
      toastVariants({ variant: "success" }),
    );
    expect(toastVariants({ variant: "success" })).not.toEqual(toastVariants({ variant: "error" }));
  });
});

describe("Toaster", () => {
  it("renders a toast for each item", () => {
    const { container } = render(() => (
      <Toaster
        toasts={[
          { id: "a", title: "Saved" },
          { id: "b", title: "Deleted" },
        ]}
      />
    ));
    expect(container.querySelectorAll("[role=status]")).toHaveLength(2);
    expect(container.textContent).toContain("Saved");
    expect(container.textContent).toContain("Deleted");
  });

  it("renders the description only when given", () => {
    const { container } = render(() => (
      <Toaster toasts={[{ id: "a", title: "Saved", description: "All changes stored" }]} />
    ));
    expect(container.textContent).toContain("All changes stored");
  });

  it("gives the title a distinct style per variant", () => {
    const { container: success } = render(() => (
      <Toaster toasts={[{ id: "a", title: "Ok", variant: "success" }]} />
    ));
    const { container: error } = render(() => (
      <Toaster toasts={[{ id: "a", title: "Ok", variant: "error" }]} />
    ));
    expect(classList(success.querySelector("[data-toast-title]")!)).not.toEqual(
      classList(error.querySelector("[data-toast-title]")!),
    );
  });

  it("calls onDismiss with the toast id when its close button is clicked", () => {
    const onDismiss = vi.fn();
    const { container } = render(() => (
      <Toaster toasts={[{ id: "toast-1", title: "Ok" }]} onDismiss={onDismiss} />
    ));
    fireEvent.click(container.querySelector("[aria-label=Dismiss]")!);
    expect(onDismiss).toHaveBeenCalledWith("toast-1");
  });
});

describe("createToastStore", () => {
  it("adds a toast via notify and removes it via dismiss", async () => {
    let store: ReturnType<typeof createToastStore> | undefined;
    let disposeRoot: (() => void) | undefined;
    createRoot((dispose) => {
      disposeRoot = dispose;
      store = createToastStore();
    });

    const id = store!.notify({ title: "Hello", duration: 0 });
    await vi.waitFor(() => expect(store!.toasts()).toHaveLength(1));
    store!.dismiss(id);
    await vi.waitFor(() => expect(store!.toasts()).toHaveLength(0));
    disposeRoot!();
  });
});

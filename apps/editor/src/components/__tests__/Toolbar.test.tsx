import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../Toolbar";
import { createTiptap } from "../../lib/tiptap";
import type { TiptapHandle } from "../../lib/tiptap";

const mediaUrl = (mediaId: string): string => `https://cdn.test/${mediaId}/file`;

const Harness = (props: { onHandle: (handle: TiptapHandle) => void }) => {
  let element: HTMLDivElement | undefined;
  const setElement = (current: HTMLDivElement): void => {
    element = current;
  };
  const handle = createTiptap({ element: () => element, initialDoc: () => undefined, mediaUrl });
  props.onHandle(handle);
  return (
    <div>
      <Toolbar
        editor={handle.editor}
        version={handle.version}
        activePanel="none"
        onTogglePanel={() => undefined}
      />
      <p data-testid="version">{handle.version()}</p>
      <div ref={setElement} />
    </div>
  );
};

const withHello = (handle: TiptapHandle): void => {
  handle.editor()?.commands.setContent({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
  });
};

describe("Toolbar", () => {
  it("toggles bold on the selection", async () => {
    let handle!: TiptapHandle;
    const { getByRole, getByTestId } = render(() => (
      <Harness onHandle={(current) => (handle = current)} />
    ));
    await vi.waitFor(() => expect(handle.editor()).toBeDefined());
    withHello(handle);
    await vi.waitFor(() => expect(getByTestId("version").textContent).toBe("1"));
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain("hello"));
    handle.editor()?.commands.selectAll();
    fireEvent.click(getByRole("button", { name: "B" }));
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain(`"type":"bold"`));
    await vi.waitFor(() => expect(handle.version()).toBeGreaterThan(1));
    await vi.waitFor(() =>
      expect(getByRole("button", { name: "B" }).getAttribute("aria-pressed")).toBe("true"),
    );
    expect(getByRole("button", { name: "B" }).getAttribute("class")).toContain("on");
  });

  it("switches block type to heading", async () => {
    let handle!: TiptapHandle;
    const { getByRole } = render(() => <Harness onHandle={(current) => (handle = current)} />);
    await vi.waitFor(() => expect(handle.editor()).toBeDefined());
    withHello(handle);
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain("hello"));
    handle.editor()?.commands.selectAll();
    fireEvent.click(getByRole("button", { name: "H2" }));
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain(`"type":"heading"`));
  });

  it("wraps the selection in a banner", async () => {
    let handle!: TiptapHandle;
    const { getByRole } = render(() => <Harness onHandle={(current) => (handle = current)} />);
    await vi.waitFor(() => expect(handle.editor()).toBeDefined());
    withHello(handle);
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain("hello"));
    handle.editor()?.commands.selectAll();
    fireEvent.click(getByRole("button", { name: "Banner" }));
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain(`"type":"banner"`));
  });

  it("wraps the selection in a blockquote", async () => {
    let handle!: TiptapHandle;
    const { getByRole } = render(() => <Harness onHandle={(current) => (handle = current)} />);
    await vi.waitFor(() => expect(handle.editor()).toBeDefined());
    withHello(handle);
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain("hello"));
    handle.editor()?.commands.selectAll();
    fireEvent.click(getByRole("button", { name: "Quote" }));
    await vi.waitFor(() => expect(JSON.stringify(handle.doc())).toContain(`"type":"blockquote"`));
  });
});

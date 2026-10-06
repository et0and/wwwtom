import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Schema } from "effect";
import { Editor } from "@tiptap/core";
import { TiptapDocSchema } from "@tom/schemas/cms";
import type { TiptapDoc } from "@tom/schemas/cms";
import { createTiptap, editorExtensions } from "../tiptap";
import type { TiptapHandle } from "../tiptap";

const mediaUrl = (mediaId: string): string => `https://cdn.test/${mediaId}/file`;

/** Every schema node type, with and without optional attrs. */
const fullDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "plain " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
        {
          type: "text",
          text: "linked",
          marks: [{ type: "link", attrs: { href: "https://tom.so", target: "_blank" } }],
        },
        {
          type: "text",
          text: "bare link",
          marks: [{ type: "link", attrs: { href: "/posts" } }],
        },
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
    { type: "horizontalRule" },
    {
      type: "codeBlock",
      attrs: { language: "ts", fileName: "a.ts", showLineNumbers: true },
      content: [{ type: "text", text: "const x = 1;" }],
    },
    {
      type: "codeBlock",
      attrs: { language: "" },
      content: [{ type: "text", text: "plain" }],
    },
    {
      type: "banner",
      attrs: { style: "warning" },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Careful" }] },
        {
          type: "banner",
          attrs: { style: "info" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Nested" }] }],
        },
      ],
    },
    { type: "arena", attrs: { slug: "toms-place", title: "Tom's Place" } },
    { type: "arena", attrs: { slug: "bare" } },
    { type: "cmsMedia", attrs: { mediaId: "media-1", alt: "Hero" } },
    { type: "cmsMedia", attrs: { mediaId: "media-2" } },
  ],
};

describe("editor extensions", () => {
  it("round-trips every node type through the server schema", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: editorExtensions(mediaUrl),
      content: fullDoc,
    });
    const json = editor.getJSON();
    editor.destroy();
    const decoded = Schema.decodeUnknownSync(TiptapDocSchema)(json);
    expect(decoded.type).toBe("doc");
    expect(decoded.content).toHaveLength(10);
  });

  it("omits unset optionals instead of nulling them", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: editorExtensions(mediaUrl),
      content: {
        type: "doc",
        content: [{ type: "arena", attrs: { slug: "bare" } }],
      },
    });
    const json = editor.getJSON() as {
      content: Array<{ attrs?: { title?: string | null } }>;
    };
    editor.destroy();
    expect(json.content[0]?.attrs?.title ?? "absent").toBe("absent");
  });
});

const Probe = (props: { onHandle: (handle: TiptapHandle) => void; initialDoc?: TiptapDoc }) => {
  let element: HTMLDivElement | undefined;
  const setElement = (current: HTMLDivElement): void => {
    element = current;
  };
  const handle = createTiptap({
    element: () => element,
    initialDoc: () => props.initialDoc,
    mediaUrl,
  });
  props.onHandle(handle);
  return <div ref={setElement} />;
};

describe("createTiptap", () => {
  it("creates an editor and tracks dirty state", async () => {
    let handle!: TiptapHandle;
    render(() => <Probe onHandle={(current) => (handle = current)} />);
    await vi.waitFor(() => expect(handle.editor()).toBeDefined());
    handle.editor()?.commands.insertContent("hello");
    await vi.waitFor(() => expect(handle.dirty()).toBe(true));
    expect(JSON.stringify(handle.doc())).toContain("hello");
  });

  it("resets content and clears dirty state", async () => {
    let handle!: TiptapHandle;
    render(() => <Probe onHandle={(current) => (handle = current)} />);
    await vi.waitFor(() => expect(handle.editor()).toBeDefined());
    handle.editor()?.commands.insertContent("hello");
    await vi.waitFor(() => expect(handle.dirty()).toBe(true));
    const next: TiptapDoc = { type: "doc", content: [{ type: "paragraph" }] };
    handle.reset(next);
    await vi.waitFor(() => expect(handle.dirty()).toBe(false));
    expect(handle.doc()).toEqual(next);
  });
});

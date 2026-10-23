import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { Editor } from "@tiptap/core";
import type { Content } from "@tiptap/core";
import { TiptapDocSchema } from "@tom/schemas/cms";
import type { TiptapDoc } from "@tom/schemas/cms";
import { editorExtensions } from "../tiptap";
import { applyLink, insertArena, insertMedia, setCodeOptions } from "../inserts";

const mediaUrl = (mediaId: string): string => `https://cdn.test/${mediaId}/file`;

const setup = (content?: TiptapDoc) => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: editorExtensions(mediaUrl),
    content: (content ?? {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    }) as Content,
  });
  editor.commands.selectAll();
  return { editor, element };
};

const teardown = (editor: Editor, element: HTMLElement): void => {
  editor.destroy();
  element.remove();
};

const decode = (editor: Editor) => Schema.decodeUnknownSync(TiptapDocSchema)(editor.getJSON());

describe("editor inserts", () => {
  it("inserts arena refs with titles", () => {
    const { editor, element } = setup();
    expect(insertArena(editor, "toms-place", "Tom's Place")).toBe(true);
    expect(JSON.stringify(decode(editor))).toContain(`"slug":"toms-place"`);
    teardown(editor, element);
  });

  it("inserts arena refs without titles", () => {
    const { editor, element } = setup();
    expect(insertArena(editor, "bare", null)).toBe(true);
    expect(JSON.stringify(decode(editor))).toContain(`"slug":"bare"`);
    teardown(editor, element);
  });

  it("rejects blank arena slugs", () => {
    const { editor, element } = setup();
    expect(insertArena(editor, "  ", null)).toBe(false);
    teardown(editor, element);
  });

  it("applies safe links", () => {
    const { editor, element } = setup();
    expect(applyLink(editor, "https://tom.so")).toBe(true);
    expect(JSON.stringify(decode(editor))).toContain(`"href":"https://tom.so"`);
    teardown(editor, element);
  });

  it("rejects dangerous links", () => {
    const { editor, element } = setup();
    expect(applyLink(editor, "javascript:alert(1)")).toBe(false);
    expect(applyLink(undefined, "https://tom.so")).toBe(false);
    teardown(editor, element);
  });

  it("unsets links on empty input", () => {
    const { editor, element } = setup();
    applyLink(editor, "https://tom.so");
    expect(applyLink(editor, "")).toBe(true);
    expect(JSON.stringify(decode(editor))).not.toContain(`"type":"link"`);
    teardown(editor, element);
  });

  it("inserts media references", () => {
    const { editor, element } = setup({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(insertMedia(editor, "media-1", "Hero")).toBe(true);
    expect(JSON.stringify(decode(editor))).toContain(`"mediaId":"media-1"`);
    teardown(editor, element);
  });

  it("rejects blank media inputs", () => {
    const { editor, element } = setup({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(insertMedia(editor, "", null)).toBe(false);
    expect(insertMedia(undefined, "media-1", null)).toBe(false);
    teardown(editor, element);
  });

  it("updates code block options", () => {
    const { editor, element } = setup({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "x" }],
        },
      ],
    });
    editor.commands.selectAll();
    expect(
      setCodeOptions(editor, { language: "js", fileName: "a.js", showLineNumbers: true }),
    ).toBe(true);
    const json = JSON.stringify(decode(editor));
    expect(json).toContain(`"language":"js"`);
    expect(json).toContain(`"fileName":"a.js"`);
    teardown(editor, element);
  });
});

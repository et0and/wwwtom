import { createSignal, onSettled } from "solid-js";
import { Editor, Node } from "@tiptap/core";
import type { Content } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import CodeBlock from "@tiptap/extension-code-block";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import type { TiptapDoc } from "@tom/schemas/cms";

/** Callout block mirroring the server TiptapDoc banner node. */
export const BannerNode = Node.create({
  name: "banner",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => ({
    style: {
      default: "info",
      parseHTML: (element) => element.getAttribute("data-banner") ?? "info",
      renderHTML: (attributes) => ({ "data-banner": attributes.style }),
    },
  }),
  parseHTML: () => [{ tag: "div[data-banner]" }],
  // The site styles served banners through .banner; the canvas carries the
  // same class so editing matches reading. No badge child: it would parse
  // back into content on load, so the canvas badge comes from CSS.
  renderHTML: ({ HTMLAttributes }) => ["div", { ...HTMLAttributes, class: "banner" }, 0],
});

/** Arena channel embed placeholder; the site renders the live carousel. */
export const ArenaNode = Node.create({
  name: "arena",
  group: "block",
  atom: true,
  addAttributes: () => ({
    slug: {
      default: "",
      parseHTML: (element) => element.getAttribute("data-arena") ?? "",
      renderHTML: (attributes) => ({ "data-arena": attributes.slug }),
    },
    title: {
      default: undefined,
      parseHTML: (element) => element.getAttribute("data-title") ?? undefined,
      renderHTML: (attributes) =>
        attributes.title === undefined ? {} : { "data-title": attributes.title },
    },
  }),
  parseHTML: () => [{ tag: "div[data-arena]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", HTMLAttributes],
});

/** Media reference with a live image preview in the editor. */
export const cmsMediaNode = (mediaUrl: (mediaId: string) => string) =>
  Node.create({
    name: "cmsMedia",
    group: "block",
    atom: true,
    addAttributes: () => ({
      mediaId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-media-id") ?? "",
        renderHTML: (attributes) => ({ "data-media-id": attributes.mediaId }),
      },
      alt: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("alt") ?? undefined,
        renderHTML: (attributes) => (attributes.alt === undefined ? {} : { alt: attributes.alt }),
      },
    }),
    parseHTML: () => [{ tag: "figure[data-media-id]" }],
    // HTMLAttributes carries rendered keys ("data-media-id"), not raw
    // node attrs, so the img src reads the rendered key back.
    renderHTML: ({ HTMLAttributes }) => [
      "figure",
      HTMLAttributes,
      [
        "img",
        {
          src: mediaUrl(String(HTMLAttributes["data-media-id"] ?? "")),
          alt: HTMLAttributes.alt ?? "",
        },
      ],
    ],
  });

/** Code block with the filename/line-number attrs the CMS schema carries. */
export const CmsCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileName: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-filename") ?? undefined,
        renderHTML: (attributes) =>
          attributes.fileName === undefined ? {} : { "data-filename": attributes.fileName },
      },
      showLineNumbers: {
        default: undefined,
        parseHTML: (element) => element.hasAttribute("data-line-numbers"),
        renderHTML: (attributes) =>
          attributes.showLineNumbers === true ? { "data-line-numbers": "true" } : {},
      },
    };
  },
});

/** Link without a null target default (the CMS schema takes string | undefined). */
export const CmsLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      target: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("target") ?? undefined,
        renderHTML: (attributes) =>
          attributes.target === undefined ? {} : { target: attributes.target },
      },
    };
  },
}).configure({ openOnClick: false });

/** Pull quote mirroring the server blockquote node. */
export const QuoteNode = Node.create({
  name: "blockquote",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML: () => [{ tag: "blockquote" }],
  renderHTML: ({ HTMLAttributes }) => ["blockquote", HTMLAttributes, 0],
});

/** Extension set matching the server TiptapDoc schema exactly. */
export const editorExtensions = (mediaUrl: (mediaId: string) => string) => [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3, 4] }),
  CmsCodeBlock,
  HorizontalRule,
  Bold,
  Italic,
  CmsLink,
  BannerNode,
  QuoteNode,
  ArenaNode,
  cmsMediaNode(mediaUrl),
];

export type TiptapHandle = {
  readonly editor: () => Editor | undefined;
  /** Bumped on every transaction so toolbar states stay reactive. */
  readonly version: () => number;
  readonly doc: () => TiptapDoc | undefined;
  readonly dirty: () => boolean;
  readonly markClean: () => void;
  readonly reset: (next: TiptapDoc) => void;
};

/**
 * Tiptap editor lifecycle as a Solid primitive. The editor owns its DOM
 * subtree; Solid owns everything around it. Output JSON mirrors the server
 * schema (limited extensions, undefined — never null — optionals).
 */
export const createTiptap = (options: {
  readonly element: () => HTMLElement | undefined;
  readonly initialDoc: () => TiptapDoc | undefined;
  readonly mediaUrl: (mediaId: string) => string;
  /** Fires with the fresh doc on every transaction (preview rendering). */
  readonly onDoc?: (doc: TiptapDoc) => void;
}): TiptapHandle => {
  const [editor, setEditor] = createSignal<Editor | undefined>(undefined);
  const [version, setVersion] = createSignal(0);
  const [doc, setDoc] = createSignal<TiptapDoc | undefined>(undefined);
  const [dirty, setDirty] = createSignal(false);

  onSettled(() => {
    const element = options.element();
    if (!element) return;
    const fallback: TiptapDoc = { type: "doc", content: [{ type: "paragraph" }] };
    const instance = new Editor({
      element,
      extensions: editorExtensions(options.mediaUrl),
      content: (options.initialDoc() ?? fallback) as Content,
      onUpdate: ({ editor: current }) => {
        const next = current.getJSON() as TiptapDoc;
        setDoc(next);
        // Read-then-set: the 2.0 beta drops notifications for updater fns.
        setVersion(version() + 1);
        setDirty(true);
        options.onDoc?.(next);
      },
    });
    setEditor(instance);
    setDoc(instance.getJSON() as TiptapDoc);
    return () => instance.destroy();
  });

  return {
    editor,
    version,
    doc,
    dirty,
    markClean: () => setDirty(false),
    reset: (next: TiptapDoc) => {
      editor()?.commands.setContent(next as Content);
      setDoc(next);
      setDirty(false);
    },
  };
};

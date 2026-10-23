import type { Editor } from "@tiptap/core";
import { isSafeLinkHref } from "@tom/utils/tiptap-html";

/**
 * Editor content insertions shared by the edit dialogs. Each command runs
 * against the editor's preserved selection, so dialogs work while the
 * editor itself is blurred. Returns false without an editor instance.
 */
export const insertArena = (
  editor: Editor | undefined,
  slug: string,
  title: string | null,
): boolean => {
  if (editor === undefined) return false;
  const cleanSlug = slug.trim();
  if (cleanSlug === "") return false;
  const cleanTitle = title === null || title.trim() === "" ? undefined : title.trim();
  const content =
    cleanTitle === undefined
      ? { type: "arena", attrs: { slug: cleanSlug } }
      : { type: "arena", attrs: { slug: cleanSlug, title: cleanTitle } };
  return editor.commands.insertContent(content);
};

export const applyLink = (editor: Editor | undefined, href: string | null): boolean => {
  if (editor === undefined) return false;
  if (href === null || href.trim() === "") return editor.commands.unsetLink();
  if (!isSafeLinkHref(href)) return false;
  return editor.commands.setLink({ href: href.trim() });
};

export const insertMedia = (
  editor: Editor | undefined,
  mediaId: string,
  alt: string | null,
): boolean => {
  if (editor === undefined || mediaId === "") return false;
  const content =
    alt === null
      ? { type: "cmsMedia", attrs: { mediaId } }
      : { type: "cmsMedia", attrs: { mediaId, alt } };
  return editor.commands.insertContent(content);
};

export type CodeOptions = {
  readonly language: string;
  readonly fileName: string | undefined;
  readonly showLineNumbers: boolean;
};

export const setCodeOptions = (editor: Editor | undefined, options: CodeOptions): boolean => {
  if (editor === undefined) return false;
  return editor.commands.updateAttributes("codeBlock", {
    language: options.language,
    fileName: options.fileName,
    showLineNumbers: options.showLineNumbers === true ? true : undefined,
  });
};

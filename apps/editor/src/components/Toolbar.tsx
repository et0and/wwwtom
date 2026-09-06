import { For, createMemo } from "solid-js";
import { Option, Schema } from "effect";
import type { Editor } from "@tiptap/core";

const BANNER_STYLES = ["info", "warning", "error", "success"] as const;

const BannerStyleSchema = Schema.Literals(["info", "warning", "error", "success"]);

type BannerStyle = typeof BannerStyleSchema.Type;

const BannerAttrsSchema = Schema.Struct({ style: Schema.optional(BannerStyleSchema) });

const isBannerStyle = (style: string): style is BannerStyle =>
  style === "info" || style === "warning" || style === "error" || style === "success";

const CODE_LANGUAGES = [
  "text",
  "typescript",
  "javascript",
  "python",
  "bash",
  "json",
  "html",
  "css",
  "sql",
  "yaml",
  "markdown",
  "go",
  "rust",
] as const;

const CodeAttrsSchema = Schema.Struct({ language: Schema.optional(Schema.String) });

/** Insert dialogs the toolbar opens; the parent owns the open panel. */
export type InsertPanel = "link" | "arena" | "media";

const INSERT_BUTTONS: ReadonlyArray<{ readonly panel: InsertPanel; readonly label: string }> = [
  { panel: "link", label: "Link" },
  { panel: "arena", label: "Arena" },
  { panel: "media", label: "Media" },
];

/**
 * Formatting toolbar for the schema-limited node set. Active states are
 * memos over the editor `version` signal: derivations belong in memos, and
 * JSX reads the memo directly so updates stay reactive.
 */
export const Toolbar = (props: {
  editor: () => Editor | undefined;
  version: () => number;
  activePanel: InsertPanel | "none" | "code";
  onTogglePanel: (panel: InsertPanel) => void;
}) => {
  const markActive = (name: string, attrs?: { level?: number; style?: string }) =>
    createMemo(() => {
      props.version();
      return props.editor()?.isActive(name, attrs) ?? false;
    });

  const boldActive = markActive("bold");
  const italicActive = markActive("italic");
  const h1Active = markActive("heading", { level: 1 });
  const h2Active = markActive("heading", { level: 2 });
  const h3Active = markActive("heading", { level: 3 });
  const paragraphActive = markActive("paragraph");
  const codeActive = markActive("codeBlock");
  const bannerActive = markActive("banner");
  const quoteActive = markActive("blockquote");

  const bannerStyle = createMemo((): BannerStyle => {
    props.version();
    const attrs = props.editor()?.getAttributes("banner");
    if (!attrs) return "info";
    const decoded = Schema.decodeUnknownOption(BannerAttrsSchema)(attrs);
    if (Option.isNone(decoded) || decoded.value.style === undefined) return "info";
    return decoded.value.style;
  });

  const codeLanguage = createMemo((): string => {
    props.version();
    const attrs = props.editor()?.getAttributes("codeBlock");
    if (!attrs) return "text";
    const decoded = Schema.decodeUnknownOption(CodeAttrsSchema)(attrs);
    if (Option.isNone(decoded) || decoded.value.language === undefined) return "text";
    return decoded.value.language;
  });

  return (
    <div class="toolbar" role="toolbar" aria-label="Formatting">
      <button
        type="button"
        class={boldActive() ? "toolbar-button on" : "toolbar-button"}
        aria-pressed={boldActive() ? "true" : "false"}
        onClick={() => props.editor()?.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        type="button"
        class={italicActive() ? "toolbar-button on" : "toolbar-button"}
        aria-pressed={italicActive() ? "true" : "false"}
        onClick={() => props.editor()?.chain().focus().toggleItalic().run()}
      >
        I
      </button>
      <button
        type="button"
        class={h1Active() ? "toolbar-button on" : "toolbar-button"}
        onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        type="button"
        class={h2Active() ? "toolbar-button on" : "toolbar-button"}
        onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        class={h3Active() ? "toolbar-button on" : "toolbar-button"}
        onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      <button
        type="button"
        class={paragraphActive() ? "toolbar-button on" : "toolbar-button"}
        onClick={() => props.editor()?.chain().focus().setParagraph().run()}
      >
        ¶
      </button>
      <button
        type="button"
        class={codeActive() ? "toolbar-button on" : "toolbar-button"}
        onClick={() => props.editor()?.chain().focus().toggleCodeBlock({ language: "text" }).run()}
      >
        {"</>"}
      </button>
      <button
        type="button"
        class="toolbar-button"
        onClick={() => props.editor()?.chain().focus().setHorizontalRule().run()}
      >
        ―
      </button>
      <button
        type="button"
        class={bannerActive() ? "toolbar-button on" : "toolbar-button"}
        onClick={() =>
          props.editor()?.chain().focus().toggleWrap("banner", { style: bannerStyle() }).run()
        }
      >
        Banner
      </button>
      <button
        type="button"
        class={quoteActive() ? "toolbar-button on" : "toolbar-button"}
        aria-pressed={quoteActive() ? "true" : "false"}
        onClick={() => props.editor()?.chain().focus().toggleWrap("blockquote").run()}
      >
        Quote
      </button>
      <label class="toolbar-select-label">
        Style
        <select
          class="toolbar-select"
          value={bannerStyle()}
          onChange={(event) => {
            const style = event.currentTarget.value;
            if (isBannerStyle(style)) {
              props.editor()?.chain().focus().updateAttributes("banner", { style }).run();
            }
          }}
        >
          <For each={BANNER_STYLES}>{(style) => <option value={style}>{style}</option>}</For>
        </select>
      </label>
      <label class="toolbar-select-label">
        Language
        <select
          class="toolbar-select"
          value={codeLanguage()}
          onChange={(event) => {
            props
              .editor()
              ?.chain()
              .focus()
              .updateAttributes("codeBlock", {
                language: event.currentTarget.value,
              })
              .run();
          }}
        >
          <For each={CODE_LANGUAGES}>
            {(language) => <option value={language}>{language}</option>}
          </For>
        </select>
      </label>
      <For each={INSERT_BUTTONS}>
        {(item) => (
          <button
            type="button"
            class={props.activePanel === item.panel ? "toolbar-button on" : "toolbar-button"}
            aria-pressed={props.activePanel === item.panel ? "true" : "false"}
            onClick={() => props.onTogglePanel(item.panel)}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
};

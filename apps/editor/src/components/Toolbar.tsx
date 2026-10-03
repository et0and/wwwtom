import * as stylex from "@stylexjs/stylex";
import { For, Show, createMemo } from "solid-js";
import { Option, Schema } from "effect";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@tom/ui/toolbar";
import { Select } from "@tom/ui/select";
import { colors } from "@tom/ui/colors.stylex";
import { CmsBannerStyleSchema } from "@tom/schemas/cms";
import type { CmsBannerStyle } from "@tom/schemas/cms";

const BANNER_STYLES = CmsBannerStyleSchema.literals;

const styles = stylex.create({
  toolbar: { minWidth: 0, maxWidth: "100%", overflowX: "auto" },
  button: { minHeight: "2.5rem", flexShrink: 0 },
  buttonActive: { backgroundColor: colors["--color-tomui-fill"], fontWeight: 500 },
});

const BannerAttrsSchema = Schema.Struct({ style: Schema.optional(CmsBannerStyleSchema) });

const isBannerStyle = Schema.is(CmsBannerStyleSchema);

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
const EditorToolbar = (props: {
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

  const bannerStyle = createMemo((): CmsBannerStyle => {
    props.version();
    const attrs = props.editor()?.getAttributes("banner");
    if (!attrs) return "info";
    const decoded = Schema.decodeOption(BannerAttrsSchema)(attrs);
    if (Option.isNone(decoded) || decoded.value.style === undefined) return "info";
    return decoded.value.style;
  });

  const codeLanguage = createMemo((): string => {
    props.version();
    const attrs = props.editor()?.getAttributes("codeBlock");
    if (!attrs) return "text";
    const decoded = Schema.decodeOption(CodeAttrsSchema)(attrs);
    if (Option.isNone(decoded) || decoded.value.language === undefined) return "text";
    return decoded.value.language;
  });

  /** Passed as a style list, because Toolbar.Button takes StyleXStyles. */
  const buttonStyle = (active: boolean): stylex.StyleXStyles[] => [
    styles.button,
    active ? styles.buttonActive : undefined,
  ];

  return (
    <div class="editor-toolbar flex flex-wrap items-center gap-2">
      <Toolbar aria-label="Formatting" style={styles.toolbar}>
        <Toolbar.Button
          aria-pressed={boldActive() ? "true" : "false"}
          style={buttonStyle(boldActive())}
          onClick={() => props.editor()?.chain().focus().toggleBold().run()}
        >
          <span class="font-bold">B</span>
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={italicActive() ? "true" : "false"}
          style={buttonStyle(italicActive())}
          onClick={() => props.editor()?.chain().focus().toggleItalic().run()}
        >
          <span class="italic">I</span>
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={h1Active() ? "true" : "false"}
          style={buttonStyle(h1Active())}
          onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={h2Active() ? "true" : "false"}
          style={buttonStyle(h2Active())}
          onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={h3Active() ? "true" : "false"}
          style={buttonStyle(h3Active())}
          onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={paragraphActive() ? "true" : "false"}
          style={buttonStyle(paragraphActive())}
          onClick={() => props.editor()?.chain().focus().setParagraph().run()}
        >
          ¶
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={codeActive() ? "true" : "false"}
          style={buttonStyle(codeActive())}
          onClick={() =>
            props.editor()?.chain().focus().toggleCodeBlock({ language: "text" }).run()
          }
        >
          {"</>"}
        </Toolbar.Button>
        <Toolbar.Button onClick={() => props.editor()?.chain().focus().setHorizontalRule().run()}>
          ―
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={bannerActive() ? "true" : "false"}
          style={buttonStyle(bannerActive())}
          onClick={() =>
            props.editor()?.chain().focus().toggleWrap("banner", { style: bannerStyle() }).run()
          }
        >
          Banner
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={quoteActive() ? "true" : "false"}
          style={buttonStyle(quoteActive())}
          onClick={() => props.editor()?.chain().focus().toggleWrap("blockquote").run()}
        >
          Quote
        </Toolbar.Button>
        <For each={INSERT_BUTTONS}>
          {(item) => (
            <Toolbar.Button
              aria-pressed={props.activePanel === item.panel ? "true" : "false"}
              style={buttonStyle(props.activePanel === item.panel)}
              onClick={() => props.onTogglePanel(item.panel)}
            >
              {item.label}
            </Toolbar.Button>
          )}
        </For>
      </Toolbar>
      <Show when={bannerActive()}>
        <label class="ml-auto flex items-center gap-1 text-xs">
          Style
          <Select
            size="sm"
            value={bannerStyle()}
            options={BANNER_STYLES.map((style) => ({ label: style, value: style }))}
            onChange={(style) => {
              if (isBannerStyle(style)) {
                props.editor()?.chain().focus().updateAttributes("banner", { style }).run();
              }
            }}
          />
        </label>
      </Show>
      <Show when={codeActive()}>
        <label class="ml-auto flex items-center gap-1 text-xs">
          Language
          <Select
            size="sm"
            value={codeLanguage()}
            options={CODE_LANGUAGES.map((language) => ({ label: language, value: language }))}
            onChange={(language) => {
              props.editor()?.chain().focus().updateAttributes("codeBlock", { language }).run();
            }}
          />
        </label>
      </Show>
    </div>
  );
};

export { EditorToolbar as Toolbar };

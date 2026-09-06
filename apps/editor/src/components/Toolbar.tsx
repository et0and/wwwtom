import { For, Show, createMemo } from "solid-js";
import { Option, Schema } from "effect";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@tom/ui/tomui/toolbar";
import { Select } from "@tom/ui/tomui/select";

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
export const EditorToolbar = (props: {
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

  const activeClass = (active: boolean): string =>
    `min-h-10 shrink-0${active ? " bg-tomui-fill font-medium" : ""}`;

  return (
    <div class="flex flex-wrap items-center gap-2">
      <Toolbar aria-label="Formatting" class="min-w-0 max-w-full overflow-x-auto">
        <Toolbar.Button
          aria-pressed={boldActive() ? "true" : "false"}
          class={activeClass(boldActive())}
          onClick={() => props.editor()?.chain().focus().toggleBold().run()}
        >
          <span class="font-bold">B</span>
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={italicActive() ? "true" : "false"}
          class={activeClass(italicActive())}
          onClick={() => props.editor()?.chain().focus().toggleItalic().run()}
        >
          <span class="italic">I</span>
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={h1Active() ? "true" : "false"}
          class={activeClass(h1Active())}
          onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={h2Active() ? "true" : "false"}
          class={activeClass(h2Active())}
          onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={h3Active() ? "true" : "false"}
          class={activeClass(h3Active())}
          onClick={() => props.editor()?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={paragraphActive() ? "true" : "false"}
          class={activeClass(paragraphActive())}
          onClick={() => props.editor()?.chain().focus().setParagraph().run()}
        >
          ¶
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={codeActive() ? "true" : "false"}
          class={activeClass(codeActive())}
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
          class={activeClass(bannerActive())}
          onClick={() =>
            props.editor()?.chain().focus().toggleWrap("banner", { style: bannerStyle() }).run()
          }
        >
          Banner
        </Toolbar.Button>
        <Toolbar.Button
          aria-pressed={quoteActive() ? "true" : "false"}
          class={activeClass(quoteActive())}
          onClick={() => props.editor()?.chain().focus().toggleWrap("blockquote").run()}
        >
          Quote
        </Toolbar.Button>
        <For each={INSERT_BUTTONS}>
          {(item) => (
            <Toolbar.Button
              aria-pressed={props.activePanel === item.panel ? "true" : "false"}
              class={activeClass(props.activePanel === item.panel)}
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

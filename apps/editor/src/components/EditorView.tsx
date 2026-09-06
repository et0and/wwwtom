import { For, Show, createMemo, createSignal, onSettled } from "solid-js";
import { Effect, Option, Schema } from "effect";
import type { CmsError } from "@tom/types/errors";
import type { CmsMedia, CmsPost, CmsWork, TiptapDoc } from "@tom/schemas/cms";
import { renderTiptapHtml } from "@tom/utils/tiptap-html";
import { adapterUrl, runClient } from "../lib/api";
import {
  getPost,
  getWork,
  listCategories,
  mediaFileUrl,
  savePost,
  saveWork,
  deletePost,
  deleteWork,
  toPostInput,
  toWorkInput,
  uploadMedia,
} from "../lib/content";
import type { ContentFields, ContentKind } from "../lib/content";
import { applyLink, insertArena, insertMedia, setCodeOptions } from "../lib/inserts";
import { createTiptap } from "../lib/tiptap";
import { HistoryPanel } from "./HistoryPanel";
import { MediaPicker } from "./MediaPicker";
import { Toolbar } from "./Toolbar";
import type { InsertPanel } from "./Toolbar";

type InitialData = {
  readonly fields: ContentFields;
  readonly doc: TiptapDoc | undefined;
  readonly categoryIds: ReadonlyArray<string>;
  readonly slug: string | null;
};

type SaveState =
  | { readonly status: "idle" }
  | { readonly status: "saving" }
  | { readonly status: "saved" }
  | { readonly status: "error"; readonly message: string };

type Panel = "none" | InsertPanel | "code";

const blankFields: ContentFields = {
  slug: "",
  title: "",
  summary: "",
  status: "draft",
  publishedAt: "",
  heroMediaId: "",
};

const toInitial = (item: CmsPost | CmsWork, slug: string): InitialData => ({
  fields: {
    slug: item.slug,
    title: item.title,
    summary: item.summary ?? "",
    status: item.status,
    publishedAt: item.publishedAt ?? "",
    heroMediaId: item.heroMediaId ?? "",
  },
  doc: item.content,
  categoryIds: "categories" in item ? item.categories.map((category) => category.id) : [],
  slug,
});

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Edit view shell: loads the post/work (or a blank form) then mounts the
 * editor body. Remounts per navigation, so body state never leaks between docs.
 */
export const EditorView = (props: {
  kind: ContentKind;
  slug: string | null;
  onExit: () => void;
}) => {
  const [initial, setInitial] = createSignal<InitialData | undefined>(undefined);
  const [error, setError] = createSignal<string | undefined>(undefined);

  onSettled(() => {
    if (props.slug === null) {
      setInitial({ fields: blankFields, doc: undefined, categoryIds: [], slug: null });
      return;
    }
    const slug = props.slug;
    const load: Effect.Effect<CmsPost | CmsWork, CmsError> =
      props.kind === "posts" ? getPost(slug) : getWork(slug);
    void runClient(
      load.pipe(
        Effect.map((item) => toInitial(item, slug)),
        Effect.tap((data) => Effect.sync(() => setInitial(data))),
        Effect.catch((cause) => Effect.sync(() => setError(cause.message))),
      ),
    );
  });

  return (
    <div class="editor-view">
      <Show when={error()}>
        {(message) => (
          <div>
            <p class="error">{message()}</p>
            <button type="button" onClick={props.onExit}>
              Back
            </button>
          </div>
        )}
      </Show>
      <Show when={initial()} fallback={error() === undefined ? <p>Loading…</p> : null}>
        {(data) => <EditorBody kind={props.kind} initial={data()} onExit={props.onExit} />}
      </Show>
    </div>
  );
};

const CodeAttrsSchema = Schema.Struct({
  language: Schema.optional(Schema.String),
  fileName: Schema.optional(Schema.String),
  showLineNumbers: Schema.optional(Schema.Boolean),
});

const EditorBody = (props: { kind: ContentKind; initial: InitialData; onExit: () => void }) => {
  const [fields, setFields] = createSignal<ContentFields>(props.initial.fields);
  const [selectedCategories, setSelected] = createSignal<ReadonlyArray<string>>(
    props.initial.categoryIds,
  );
  const [allCategories, setAllCategories] = createSignal<
    ReadonlyArray<{ readonly id: string; readonly title: string }>
  >([]);
  const [savedSlug, setSavedSlug] = createSignal<string | null>(props.initial.slug);
  const [saveState, setSaveState] = createSignal<SaveState>({ status: "idle" });
  const [showPreview, setShowPreview] = createSignal(false);
  const [showHistory, setShowHistory] = createSignal(false);
  /** Current history reload; revoked to noop when the panel unmounts. */
  type HistoryReload = { current: () => void };
  const historyReload: HistoryReload = { current: () => undefined };
  const [panel, setPanel] = createSignal<Panel>("none");
  const [panelError, setPanelError] = createSignal<string | undefined>(undefined);

  const [linkUrl, setLinkUrl] = createSignal("");
  const [arenaSlug, setArenaSlug] = createSignal("");
  const [arenaTitle, setArenaTitle] = createSignal("");
  const [mediaAlt, setMediaAlt] = createSignal("");
  const [pickedFile, setPickedFile] = createSignal<File | undefined>(undefined);
  const [uploading, setUploading] = createSignal(false);

  let element: HTMLDivElement | undefined;
  const setElement = (current: HTMLDivElement): void => {
    element = current;
  };
  const mediaUrl = (mediaId: string): string => mediaFileUrl(adapterUrl(), mediaId);
  const [previewHtml, setPreviewHtml] = createSignal("");

  /** Render preview HTML; stale results lose to newer docs by identity. */
  const renderPreview = (doc: TiptapDoc): void => {
    void runClient(
      renderTiptapHtml(doc, mediaUrl).pipe(
        Effect.tap((html) =>
          Effect.sync(() => {
            if (handle.doc() === doc) setPreviewHtml(html);
          }),
        ),
      ),
    );
  };

  const handle = createTiptap({
    element: () => element,
    initialDoc: () => props.initial.doc,
    mediaUrl,
    onDoc: (doc) => {
      if (showPreview()) renderPreview(doc);
    },
  });

  onSettled(() => {
    if (props.kind !== "posts") return;
    void runClient(
      listCategories().pipe(
        Effect.tap((categories) => Effect.sync(() => setAllCategories(categories))),
        Effect.catch((cause) =>
          Effect.sync(() => setSaveState({ status: "error", message: cause.message })),
        ),
      ),
    );
  });

  const setField = (key: keyof ContentFields, value: string): void => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSaveState({ status: "idle" });
  };

  const setStatus = (value: string): void => {
    setField("status", value === "published" ? "published" : "draft");
  };

  const persist = (
    slug: string | null,
    doc: TiptapDoc,
  ): Effect.Effect<CmsPost | CmsWork, CmsError> =>
    props.kind === "posts"
      ? Effect.flatMap(toPostInput(fields(), doc, selectedCategories()), (input) =>
          savePost(slug, input),
        )
      : Effect.flatMap(toWorkInput(fields(), doc), (input) => saveWork(slug, input));

  const onSave = (): void => {
    const doc = handle.doc() ?? { type: "doc", content: [] };
    setSaveState({ status: "saving" });
    void runClient(
      persist(savedSlug(), doc as TiptapDoc).pipe(
        Effect.tap((saved) =>
          Effect.sync(() => {
            handle.markClean();
            setSavedSlug(saved.slug);
            setSaveState({ status: "saved" });
            historyReload.current();
          }),
        ),
        Effect.catch((cause) =>
          Effect.sync(() => setSaveState({ status: "error", message: cause.message })),
        ),
      ),
    );
  };

  const onDelete = (): void => {
    const slug = savedSlug();
    if (slug === null || !window.confirm(`Delete ${slug}?`)) return;
    void runClient(
      (props.kind === "posts" ? deletePost(slug) : deleteWork(slug)).pipe(
        Effect.tap(() => Effect.sync(props.onExit)),
        Effect.catch((cause) =>
          Effect.sync(() => setSaveState({ status: "error", message: cause.message })),
        ),
      ),
    );
  };

  const onRestored = (saved: CmsPost | CmsWork): void => {
    const data = toInitial(saved, saved.slug);
    setFields(data.fields);
    if (props.kind === "posts") setSelected(data.categoryIds);
    if (data.doc) handle.reset(data.doc);
    handle.markClean();
    setSavedSlug(saved.slug);
    setSaveState({ status: "saved" });
    setShowHistory(false);
  };

  const onBack = (): void => {
    if (!handle.dirty() || window.confirm("Discard unsaved changes?")) props.onExit();
  };

  const openPanel = (next: Panel): void => {
    setPanelError(undefined);
    setPanel(next);
  };

  const toggleCategory = (id: string): void => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id],
    );
  };

  const onInsertArena = (): void => {
    if (!insertArena(handle.editor(), arenaSlug(), arenaTitle() === "" ? null : arenaTitle())) {
      setPanelError("Arena slug is required");
      return;
    }
    setPanel("none");
  };

  const onApplyLink = (): void => {
    if (!applyLink(handle.editor(), linkUrl() === "" ? null : linkUrl())) {
      setPanelError("Use an http(s), mailto, /, or # link");
      return;
    }
    setPanel("none");
  };

  const onUpload = (): void => {
    const file = pickedFile();
    if (!file) return;
    setUploading(true);
    void runClient(
      uploadMedia(file, mediaAlt() === "" ? null : mediaAlt()).pipe(
        Effect.tap((media) =>
          Effect.sync(() => {
            insertMedia(handle.editor(), media.id, media.alt);
            setUploading(false);
            setPickedFile(undefined);
            setPanel("none");
          }),
        ),
        Effect.catch((cause) =>
          Effect.sync(() => {
            setUploading(false);
            setPanelError(cause.message);
          }),
        ),
      ),
    );
  };

  const onPickMedia = (item: CmsMedia): void => {
    const alt = mediaAlt() === "" ? item.alt : mediaAlt();
    if (!insertMedia(handle.editor(), item.id, alt)) {
      setPanelError("Editor not ready");
      return;
    }
    setPanel("none");
  };

  const saveError = createMemo(() => {
    const state = saveState();
    return state.status === "error" ? state.message : undefined;
  });

  const togglePreview = (): void => {
    const next = !showPreview();
    setShowPreview(next);
    if (next) {
      const doc = handle.doc();
      if (doc) renderPreview(doc);
    }
  };

  const codeActive = createMemo(() => {
    handle.version();
    return handle.editor()?.isActive("codeBlock") ?? false;
  });

  const codeAttrs = createMemo(() => {
    handle.version();
    const attrs = handle.editor()?.getAttributes("codeBlock");
    if (!attrs) return undefined;
    const decoded = Schema.decodeUnknownOption(CodeAttrsSchema)(attrs);
    return Option.isNone(decoded) ? undefined : decoded.value;
  });

  return (
    <div class="editor-body">
      <div class="editor-topbar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <Show when={handle.dirty()}>
          <span class="dirty-flag">Unsaved changes</span>
        </Show>
        <Show when={saveState().status === "saving"}>
          <span>Saving…</span>
        </Show>
        <Show when={saveState().status === "saved"}>
          <span>Saved</span>
        </Show>
        <Show when={saveError()}>{(message) => <span class="error">{message()}</span>}</Show>
        <button type="button" class="save-button" onClick={onSave}>
          {savedSlug() === null ? "Create" : "Save"}
        </button>
        <Show when={savedSlug() !== null}>
          <button type="button" class="delete-button" onClick={onDelete}>
            Delete
          </button>
          <button type="button" onClick={() => setShowHistory(!showHistory())}>
            {showHistory() ? "Hide history" : "History"}
          </button>
        </Show>
      </div>
      <Show when={showHistory() ? savedSlug() : null}>
        {(slug) => (
          <HistoryPanel
            kind={props.kind}
            slug={slug()}
            onRestored={onRestored}
            onReload={(reload) => {
              historyReload.current = reload;
            }}
          />
        )}
      </Show>

      <div class="editor-fields">
        <label class="field">
          Title
          <input
            type="text"
            value={fields().title}
            onInput={(event) => setField("title", event.currentTarget.value)}
          />
        </label>
        <label class="field">
          Slug
          <input
            type="text"
            value={fields().slug}
            onInput={(event) => setField("slug", event.currentTarget.value)}
          />
        </label>
        <button type="button" onClick={() => setField("slug", slugify(fields().title))}>
          Use title
        </button>
        <label class="field">
          Summary
          <textarea
            value={fields().summary}
            onInput={(event) => setField("summary", event.currentTarget.value)}
          />
        </label>
        <label class="field">
          Status
          <select
            value={fields().status}
            onChange={(event) => setStatus(event.currentTarget.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label class="field">
          Published at
          <input
            type="datetime-local"
            value={fields().publishedAt.slice(0, 16)}
            onInput={(event) => setField("publishedAt", event.currentTarget.value)}
          />
        </label>
        <label class="field">
          Hero media id
          <input
            type="text"
            value={fields().heroMediaId}
            onInput={(event) => setField("heroMediaId", event.currentTarget.value)}
          />
        </label>
        <Show when={fields().heroMediaId !== ""}>
          <img
            class="hero-preview"
            src={mediaFileUrl(adapterUrl(), fields().heroMediaId)}
            alt="Hero preview"
          />
        </Show>
      </div>

      <Show when={props.kind === "posts"}>
        <fieldset class="field">
          <legend>Categories</legend>
          <For each={allCategories()}>
            {(category) => (
              <label class="check">
                <input
                  type="checkbox"
                  checked={selectedCategories().includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                />
                {category.title}
              </label>
            )}
          </For>
        </fieldset>
      </Show>

      <Toolbar
        editor={handle.editor}
        version={handle.version}
        activePanel={panel()}
        onTogglePanel={(item) => openPanel(panel() === item ? "none" : item)}
      />
      <div ref={setElement} class="tiptap-editor" />

      <div class="editor-panels">
        <Show when={panelError()}>{(message) => <p class="error">{message()}</p>}</Show>
        <Show when={panel() === "link"}>
          <div class="panel">
            <label class="field">
              URL
              <input
                type="text"
                value={linkUrl()}
                onInput={(event) => setLinkUrl(event.currentTarget.value)}
              />
            </label>
            <button type="button" onClick={onApplyLink}>
              Apply
            </button>
          </div>
        </Show>
        <Show when={panel() === "arena"}>
          <div class="panel">
            <label class="field">
              Channel slug
              <input
                type="text"
                value={arenaSlug()}
                onInput={(event) => setArenaSlug(event.currentTarget.value)}
              />
            </label>
            <label class="field">
              Title (optional)
              <input
                type="text"
                value={arenaTitle()}
                onInput={(event) => setArenaTitle(event.currentTarget.value)}
              />
            </label>
            <button type="button" onClick={onInsertArena}>
              Insert
            </button>
          </div>
        </Show>
        <Show when={panel() === "media"}>
          <div class="panel">
            <label class="field">
              File
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(event) => setPickedFile(event.currentTarget.files?.[0])}
              />
            </label>
            <label class="field">
              Alt text
              <input
                type="text"
                value={mediaAlt()}
                onInput={(event) => setMediaAlt(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={pickedFile() === undefined || uploading()}
              onClick={onUpload}
            >
              {uploading() ? "Uploading…" : "Upload and insert"}
            </button>
            <MediaPicker onPick={onPickMedia} />
          </div>
        </Show>
        <Show when={codeActive()}>
          <div class="panel">
            <label class="field">
              File name
              <input
                type="text"
                value={codeAttrs()?.fileName ?? ""}
                onInput={(event) => {
                  setCodeOptions(handle.editor(), {
                    language: codeAttrs()?.language ?? "",
                    fileName:
                      event.currentTarget.value === "" ? undefined : event.currentTarget.value,
                    showLineNumbers: codeAttrs()?.showLineNumbers ?? false,
                  });
                }}
              />
            </label>
            <label class="check">
              <input
                type="checkbox"
                checked={codeAttrs()?.showLineNumbers ?? false}
                onChange={(event) => {
                  setCodeOptions(handle.editor(), {
                    language: codeAttrs()?.language ?? "",
                    fileName: codeAttrs()?.fileName,
                    showLineNumbers: event.currentTarget.checked,
                  });
                }}
              />
              Line numbers
            </label>
          </div>
        </Show>
      </div>

      <button type="button" onClick={togglePreview}>
        {showPreview() ? "Hide preview" : "Show preview"}
      </button>
      <Show when={showPreview()}>
        <div class="preview" innerHTML={previewHtml()} />
      </Show>
    </div>
  );
};

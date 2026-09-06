import { Effect, Option, Ref } from "effect";
import type { CmsBannerStyle, TiptapBlock, TiptapDoc, TiptapInline } from "@tom/schemas/cms";

/** Resolve an editor media reference to its absolute public file URL. */
export type MediaUrlResolver = (mediaId: string) => string;

/** Badge label per banner style; styles come from the validated schema. */
const BANNER_TITLES = {
  info: "Note",
  warning: "Warning",
  error: "Error",
  success: "Success",
} satisfies Record<CmsBannerStyle, string>;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Keep only navigable link targets; anything else renders as plain text. */
export const isSafeLinkHref = (href: string): boolean => {
  const target = href.trim();
  return (
    target.startsWith("https://") ||
    target.startsWith("http://") ||
    target.startsWith("mailto:") ||
    target.startsWith("/") ||
    target.startsWith("#")
  );
};

const safeHref = (href: string): string | null => {
  const target = href.trim();
  return isSafeLinkHref(href) ? target : null;
};

/**
 * Only these link targets render; anything else (e.g. pasted
 * `target="evil"` or javascript-frame tricks) is dropped. Enforced here
 * rather than in the schema so legacy rows keep decoding.
 */
const SAFE_LINK_TARGETS: ReadonlySet<string> = new Set(["_blank", "_self"]);

const renderInline = (inline: TiptapInline): string => {
  const text = escapeHtml(inline.text);
  const marks = inline.marks ?? [];
  return marks.reduce((inner, mark) => {
    if (mark.type === "bold") return `<strong>${inner}</strong>`;
    if (mark.type === "italic") return `<em>${inner}</em>`;
    const href = safeHref(mark.attrs.href);
    if (href === null) return inner;
    const target = mark.attrs.target;
    const targetAttr =
      target !== undefined && SAFE_LINK_TARGETS.has(target)
        ? ` target="${escapeHtml(target)}"`
        : "";
    const rel = target === "_blank" ? ` rel="noopener"` : "";
    return `<a href="${escapeHtml(href)}"${targetAttr}${rel}>${inner}</a>`;
  }, text);
};

const renderInlines = (content: ReadonlyArray<TiptapInline> | undefined): string =>
  (content ?? []).map(renderInline).join("");

const renderBlocks = (
  blocks: ReadonlyArray<TiptapBlock>,
  resolveMediaUrl: MediaUrlResolver,
): Effect.Effect<string, never> =>
  Effect.forEach(blocks, (block) => renderBlock(block, resolveMediaUrl)).pipe(
    Effect.map((parts) => parts.join("")),
  );

/** Languages bundled for highlighting; anything else renders plain. */
const KNOWN_CODE_LANGUAGES: ReadonlyArray<string> = [
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
];

/** Short aliases to bundled language ids. */
type CodeLanguageAliases = {
  readonly [alias: string]: string | undefined;
};
const CODE_LANGUAGE_ALIASES: CodeLanguageAliases = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  md: "markdown",
  yml: "yaml",
};

type Highlighter = Awaited<ReturnType<(typeof import("shiki/core"))["createHighlighterCore"]>>;

const highlighterRef: Ref.Ref<Option.Option<Highlighter>> = Effect.runSync(Ref.make(Option.none()));

const createHighlighter = async (): Promise<Highlighter> => {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, ...bundles] =
    await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      Promise.all([
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/python.mjs"),
        import("shiki/langs/bash.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/html.mjs"),
        import("shiki/langs/css.mjs"),
        import("shiki/langs/sql.mjs"),
        import("shiki/langs/yaml.mjs"),
        import("shiki/langs/markdown.mjs"),
        import("shiki/langs/go.mjs"),
        import("shiki/langs/rust.mjs"),
      ]),
      Promise.all([
        import("shiki/themes/github-light.mjs"),
        import("shiki/themes/vitesse-dark.mjs"),
      ]),
    ]);
  return createHighlighterCore({
    themes: bundles[1].map((theme) => theme.default),
    langs: bundles[0].map((lang) => lang.default),
    engine: createJavaScriptRegexEngine(),
  });
};

/** Cached Shiki instance; init failures retry on the next code block. */
const getHighlighter = Effect.gen(function* () {
  const cached = yield* Ref.get(highlighterRef);
  if (Option.isSome(cached)) return cached;
  const fresh = yield* Effect.option(
    Effect.tryPromise({
      try: () => createHighlighter(),
      catch: () => new Error("shiki init failed"),
    }).pipe(Effect.tap((loaded) => Ref.set(highlighterRef, Option.some(loaded)))),
  );
  return fresh;
});

const codeFigure = (
  inner: string,
  fileName: string | undefined,
  showLineNumbers: boolean,
): string =>
  `<figure class="code-block"${showLineNumbers ? ` data-line-numbers="true"` : ""}>` +
  (fileName === undefined
    ? ""
    : `<figcaption class="code-filename">${escapeHtml(fileName)}</figcaption>`) +
  inner +
  `</figure>`;

/** Plain fallback matching the highlighted structure (both themes). */
const plainCode = (code: string, language: string): string => {
  const pre = `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
  return `<div class="shiki-light">${pre}</div><div class="shiki-dark">${pre}</div>`;
};

const highlightCode = (
  code: string,
  language: string,
  fileName: string | undefined,
  showLineNumbers: boolean,
): Effect.Effect<string, never> =>
  Effect.gen(function* () {
    const canonical = CODE_LANGUAGE_ALIASES[language] ?? language;
    if (!KNOWN_CODE_LANGUAGES.includes(canonical)) {
      return codeFigure(plainCode(code, language), fileName, showLineNumbers);
    }
    const highlighter = yield* getHighlighter;
    if (Option.isNone(highlighter)) {
      return codeFigure(plainCode(code, language), fileName, showLineNumbers);
    }
    return yield* Effect.try({
      try: () => {
        const light = highlighter.value.codeToHtml(code, {
          lang: canonical,
          theme: "github-light",
        });
        const dark = highlighter.value.codeToHtml(code, { lang: canonical, theme: "vitesse-dark" });
        return codeFigure(
          `<div class="shiki-light">${light}</div><div class="shiki-dark">${dark}</div>`,
          fileName,
          showLineNumbers,
        );
      },
      catch: () => new Error("shiki highlight failed"),
    }).pipe(
      Effect.tapError((cause) => Effect.logWarning("Code highlight failed", cause)),
      Effect.catch(() =>
        Effect.succeed(codeFigure(plainCode(code, language), fileName, showLineNumbers)),
      ),
    );
  });

const renderBlock = (
  block: TiptapBlock,
  resolveMediaUrl: MediaUrlResolver,
): Effect.Effect<string, never> => {
  if (block.type === "paragraph") return Effect.succeed(`<p>${renderInlines(block.content)}</p>`);
  if (block.type === "heading")
    return Effect.succeed(
      `<h${block.attrs.level}>${renderInlines(block.content)}</h${block.attrs.level}>`,
    );
  if (block.type === "horizontalRule") return Effect.succeed("<hr>");
  if (block.type === "codeBlock") {
    const code = (block.content ?? []).map((inline) => inline.text).join("");
    return highlightCode(
      code,
      block.attrs.language,
      block.attrs.fileName,
      block.attrs.showLineNumbers === true,
    );
  }
  if (block.type === "banner")
    return renderBlocks(block.content, resolveMediaUrl).pipe(
      Effect.map(
        (inner) =>
          `<div role="region" class="banner" data-banner="${block.attrs.style}">` +
          `<p class="banner-title">${BANNER_TITLES[block.attrs.style]}</p>` +
          `${inner}</div>`,
      ),
    );
  if (block.type === "blockquote")
    return renderBlocks(block.content, resolveMediaUrl).pipe(
      Effect.map((inner) => `<blockquote>${inner}</blockquote>`),
    );
  if (block.type === "arena") {
    const title =
      block.attrs.title === undefined ? "" : ` data-title="${escapeHtml(block.attrs.title)}"`;
    return Effect.succeed(`<div data-arena="${escapeHtml(block.attrs.slug)}"${title}></div>`);
  }
  const alt = block.attrs.alt === undefined ? "" : ` alt="${escapeHtml(block.attrs.alt)}"`;
  return Effect.succeed(
    `<figure><img src="${escapeHtml(resolveMediaUrl(block.attrs.mediaId))}"${alt}></figure>`,
  );
};

/**
 * Render a validated Tiptap document to HTML at write time. Input is already
 * schema-validated, so rendering is total: text and attributes are escaped,
 * dangerous link targets are dropped, code falls back to plain output when
 * highlighting is unavailable, and the output is safe to inject.
 */
export const renderTiptapHtml = (
  doc: TiptapDoc,
  resolveMediaUrl: MediaUrlResolver,
): Effect.Effect<string, never> => renderBlocks(doc.content, resolveMediaUrl);

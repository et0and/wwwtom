import { Effect } from "effect";
import { codeToTokens, isSupportedLanguage, type Lang, type ThemedToken } from "@pierre/highlights";
import githubLight from "@pierre/highlights/themes/github-light";
import vitesseDark from "@pierre/highlights/themes/vitesse-dark";
import type { CmsBannerStyle, TiptapBlock, TiptapDoc, TiptapInline } from "@tom/schemas/cms";
import { CodeHighlightError } from "@tom/types/errors";

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
const safeHref = (href: string): string | null => {
  const target = href.trim();
  return target.startsWith("https://") ||
    target.startsWith("http://") ||
    target.startsWith("mailto:") ||
    target.startsWith("/") ||
    target.startsWith("#")
    ? target
    : null;
};

/** Navigability check over the same trimmed target safeHref renders. */
export const isSafeLinkHref = (href: string): boolean => safeHref(href) !== null;

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

const PLAIN_CODE_LANGUAGES: ReadonlySet<string> = new Set(["plain", "plaintext", "text", "txt"]);

const renderToken = (token: ThemedToken): string => {
  const declarations = Object.entries(token.htmlStyle ?? {})
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
  const style = declarations === "" ? "" : ` style="${escapeHtml(declarations)}"`;
  return `<span${style}>${escapeHtml(token.content)}</span>`;
};

const highlightedCode = (code: string, language: Lang): string => {
  const { tokens, fg, bg } = codeToTokens(code, {
    lang: language,
    themes: { light: githubLight, dark: vitesseDark },
    defaultColor: "light-dark()",
  });
  const declarations = [
    fg === undefined ? undefined : `color:${fg}`,
    bg === undefined ? undefined : `background-color:${bg}`,
  ]
    .filter((value): value is string => value !== undefined)
    .join(";");
  const style = declarations === "" ? "" : ` style="${escapeHtml(declarations)}"`;
  const lines = tokens
    .map((line) => `<span class="line">${line.map(renderToken).join("")}</span>`)
    .join("\n");
  return `<pre${style}><code>${lines}</code></pre>`;
};

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

/** Plain fallback used when a language has no lexer or highlighting fails. */
const plainCode = (code: string, language: string): string =>
  `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;

const highlightCode = (
  code: string,
  language: string,
  fileName: string | undefined,
  showLineNumbers: boolean,
): Effect.Effect<string, never> => {
  const fallback = codeFigure(plainCode(code, language), fileName, showLineNumbers);
  const canonical = language.trim().toLowerCase();
  if (PLAIN_CODE_LANGUAGES.has(canonical) || !isSupportedLanguage(canonical)) {
    return Effect.succeed(fallback);
  }
  return Effect.try({
    try: () => codeFigure(highlightedCode(code, canonical), fileName, showLineNumbers),
    catch: (cause) => new CodeHighlightError({ message: "code highlight failed", cause }),
  }).pipe(
    Effect.tapError((cause) => Effect.logWarning("Code highlight failed", cause)),
    Effect.orElseSucceed(() => fallback),
  );
};

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

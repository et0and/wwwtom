import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import js from "shiki/langs/javascript.mjs";
import py from "shiki/langs/python.mjs";
import rs from "shiki/langs/rust.mjs";
import ts from "shiki/langs/typescript.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import vitesseDark from "shiki/themes/vitesse-dark.mjs";

let highlighter: Awaited<ReturnType<typeof createHighlighterCore>> | undefined;

async function getHighlighter() {
  if (highlighter) return highlighter;

  highlighter = await createHighlighterCore({
    themes: [githubLight, vitesseDark],
    langs: [ts, js, py, rs, html, css],
    engine: createJavaScriptRegexEngine(),
  });

  return highlighter;
}

export async function highlightCodeToHtml(
  code: string,
  language: string,
  theme: string,
): Promise<string> {
  const h = await getHighlighter();
  return h.codeToHtml(code, { lang: language || "text", theme });
}

export async function highlightCodeBlock(
  code: string,
  language: string,
  fileName?: string,
  showLineNumbers?: boolean,
): Promise<string> {
  const [lightHtml, darkHtml] = await Promise.all([
    highlightCodeToHtml(code, language, "github-light"),
    highlightCodeToHtml(code, language, "vitesse-dark"),
  ]);

  const lineNumbersAttr = showLineNumbers ? ' data-line-numbers="true"' : "";
  const fileNameHtml = fileName ? `<figcaption class="code-filename">${fileName}</figcaption>` : "";

  return `<figure class="code-block"${lineNumbersAttr}>
	${fileNameHtml}
	<div class="shiki-light">${lightHtml}</div>
	<div class="shiki-dark">${darkHtml}</div>
</figure>`;
}

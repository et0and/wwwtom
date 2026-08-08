import { Effect, Option, Ref } from "effect";
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

type Highlighter = Awaited<ReturnType<typeof createHighlighterCore>>;

const highlighterRef = Effect.runSync(Ref.make<Option.Option<Highlighter>>(Option.none()));

const getHighlighter = Effect.gen(function* () {
  const cached = yield* Ref.get(highlighterRef);
  if (Option.isSome(cached)) {
    return cached.value;
  }
  const highlighter = yield* Effect.tryPromise(() =>
    createHighlighterCore({
      themes: [githubLight, vitesseDark],
      langs: [ts, js, py, rs, html, css],
      engine: createJavaScriptRegexEngine(),
    }),
  );
  yield* Ref.update(highlighterRef, () => Option.some(highlighter));
  return highlighter;
});

export const highlightCodeToHtml = (
  code: string,
  language: string,
  theme: string,
): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    const highlighter = yield* getHighlighter;
    return yield* Effect.try(() =>
      highlighter.codeToHtml(code, { lang: language || "text", theme }),
    );
  });

export const highlightCodeBlock = (
  code: string,
  language: string,
  fileName?: string,
  showLineNumbers?: boolean,
): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    const [lightHtml, darkHtml] = yield* Effect.all([
      highlightCodeToHtml(code, language, "github-light"),
      highlightCodeToHtml(code, language, "vitesse-dark"),
    ]);

    const lineNumbersAttr = showLineNumbers ? ' data-line-numbers="true"' : "";
    const fileNameHtml = fileName
      ? `<figcaption class="code-filename">${fileName}</figcaption>`
      : "";

    return `<figure class="code-block"${lineNumbersAttr}>
	${fileNameHtml}
	<div class="shiki-light">${lightHtml}</div>
	<div class="shiki-dark">${darkHtml}</div>
</figure>`;
  });

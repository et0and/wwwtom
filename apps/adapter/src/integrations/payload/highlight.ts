import { Effect, Option, Ref } from "effect";

type Highlighter = Awaited<ReturnType<(typeof import("shiki/core"))["createHighlighterCore"]>>;

const highlighterRef = Effect.runSync(Ref.make<Option.Option<Highlighter>>(Option.none()));

const getHighlighter = Effect.gen(function* () {
  const cached = yield* Ref.get(highlighterRef);
  if (Option.isSome(cached)) {
    return cached.value;
  }

  // Load shiki lazily so its grammars and themes stay out of the adapter's
  // cold-start module graph (only code blocks need highlighting).
  const highlighter = yield* Effect.tryPromise(async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, langs, themes] =
      await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
        Promise.all([
          import("shiki/langs/css.mjs"),
          import("shiki/langs/html.mjs"),
          import("shiki/langs/javascript.mjs"),
          import("shiki/langs/python.mjs"),
          import("shiki/langs/rust.mjs"),
          import("shiki/langs/typescript.mjs"),
        ]),
        Promise.all([
          import("shiki/themes/github-light.mjs"),
          import("shiki/themes/vitesse-dark.mjs"),
        ]),
      ]);

    return createHighlighterCore({
      themes: themes.map((theme) => theme.default),
      langs: langs.map((lang) => lang.default),
      engine: createJavaScriptRegexEngine(),
    });
  });

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

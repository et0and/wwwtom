import { Effect, Schema } from "effect";
import { render } from "takumi-js";
import { fromHtml } from "takumi-js/helpers/html";
import { ogImageQueryParamsSchema, type OgTemplate } from "@tom/schemas/og";
import { OgTemplates, type OgTemplateParams } from "@tom/ui/OgImage";
import { FontFetchError, ValidationError, ImageGenerationError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { toProblemResponse } from "@tom/utils/services/worker";

const FONT_URL = "https://cdn.tom.so/LibreCaslonCondensed-Regular.ttf";
// Pinned: @latest floats and would ship unreviewed glyph changes to every
// render. Verified 5.3.0 serves latin-400-normal.woff2 on jsDelivr.
const SOLWAY_URL = "https://cdn.jsdelivr.net/fontsource/fonts/solway@5.3.0/latin-400-normal.woff2";
const FONT_FETCH_TIMEOUT_MS = 3000;

interface FontCache {
  data: ArrayBuffer | null;
  sophie: ArrayBuffer | null;
}

const fontCache: FontCache = { data: null, sophie: null };

const fetchFontBytes = (url: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(url, { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) }).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch font: ${res.status}`);
        }
        return res.arrayBuffer();
      }),
    catch: (error) =>
      new FontFetchError({
        message: "Failed to fetch font",
        cause: error instanceof Error ? error.message : "Unknown error",
      }),
  });

export const fontFetchEffect = Effect.gen(function* () {
  yield* Effect.logInfo("Fetching font");
  if (fontCache.data !== null) {
    yield* Effect.logInfo("Pulling cached font files");
    return fontCache.data;
  }

  const data = yield* fetchFontBytes(FONT_URL);

  fontCache.data = data;

  return data;
}).pipe(Effect.withSpan("og.fetchFont"));

export const sophieFontFetchEffect = Effect.gen(function* () {
  if (fontCache.sophie !== null) {
    return fontCache.sophie;
  }

  const data = yield* fetchFontBytes(SOLWAY_URL);

  fontCache.sophie = data;

  return data;
}).pipe(Effect.withSpan("og.fetchSophieFont"));

export const getTemplate = (
  requester: string,
  templateParam?: OgTemplate,
): ((params: OgTemplateParams) => string) => {
  if (templateParam === "default") return OgTemplates.default;
  if (templateParam === "minimal") return OgTemplates.minimal;
  if (templateParam === "developer") return OgTemplates.developer;
  if (templateParam === "sophie") return OgTemplates.sophie;
  if (requester.includes("sophie.st")) return OgTemplates.sophie;
  if (requester.includes("dev.tom.so")) return OgTemplates.developer;
  if (requester.includes("tom.so")) return OgTemplates.default;
  return OgTemplates.minimal;
};

export const generateOgImageEffect = Effect.fn("og.generate")(function* (
  title: string,
  summary: string,
  requester: string,
  templateParam?: OgTemplate,
  date?: string,
) {
  yield* Effect.logInfo("Generating OG image");
  const template = getTemplate(requester, templateParam);
  // Libre Caslon Condensed only serves the default template (minimal is
  // system-ui, developer is monospace); Solway only serves sophie. Fetch
  // lazily so a font outage cannot break templates that never use it.
  const fontData = template === OgTemplates.default ? yield* fontFetchEffect : null;
  // Solway is third-party (jsDelivr): never 502 Tom traffic when it fails —
  // render sophie on the Georgia/serif fallback stack and log the failure.
  const sophieFontData =
    template === OgTemplates.sophie
      ? yield* sophieFontFetchEffect.pipe(
          Effect.catch((error) =>
            Effect.logWarning("Solway fetch failed, rendering with fallback serif", error).pipe(
              Effect.map(() => null),
            ),
          ),
        )
      : null;

  const html = template({ title, summary, date: date ?? "" });
  const { node, css } = fromHtml(html);
  const png = yield* Effect.tryPromise({
    try: () =>
      render(node, {
        width: 1200,
        height: 630,
        css,
        fonts: [
          ...(fontData === null
            ? []
            : [{ name: "Libre Caslon Condensed", data: fontData, weight: 400, style: "normal" }]),
          ...(sophieFontData === null
            ? []
            : [{ name: "Solway", data: sophieFontData, weight: 400, style: "normal" }]),
        ],
      }),
    catch: () =>
      new ImageGenerationError({
        message: "Failed to render OG image",
      }),
  });

  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, immutable, no-transform, max-age=31536000",
    },
  });
});

export const validateOgParams = (
  title: string,
  summary: string,
  date?: string,
  template?: string,
) => {
  return Schema.decodeUnknownEffect(ogImageQueryParamsSchema)({
    title,
    summary,
    date,
    template,
  }).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        new ValidationError({
          field: "params",
          issue: error.message || "Invalid query parameters",
        }),
      ),
    ),
  );
};

export const handleOgError = (
  error: FontFetchError | ValidationError | ImageGenerationError,
): Response => {
  if (error instanceof FontFetchError) {
    return toProblemResponse(HttpStatus.BadGateway, error.message, {
      type: ProblemType.Upstream,
      detail: error.cause,
    });
  }
  if (error instanceof ValidationError) {
    return toProblemResponse(HttpStatus.BadRequest, "Validation error", {
      type: ProblemType.Validation,
      detail: `${error.field} - ${error.issue}`,
      errors: [{ pointer: `#/${error.field}`, detail: error.issue }],
    });
  }
  return toProblemResponse(HttpStatus.InternalServerError, error.message);
};

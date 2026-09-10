import { Effect, Option, Schema } from "effect";
import { render } from "takumi-js";
import { fromHtml } from "takumi-js/helpers/html";
import { ogImageQueryParamsSchema, type OgTemplate } from "@tom/schemas/og";
import { OgTemplates, type OgTemplateParams } from "@tom/ui/OgImage";
import { FontFetchError, ValidationError, ImageGenerationError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import type { CmsAssetsBinding } from "@tom/utils/services/config";
import { toProblemResponse } from "@tom/utils/services/worker";

// Fonts ship as static files beside the worker (apps/api/public/fonts,
// served by Workers Static Assets) and load from the worker's own origin:
// no third-party fetch, no cold-start dependency on an external CDN.
const LIBRE_CASLON_PATH = "/fonts/libre-caslon-condensed-regular.ttf";
const SOLWAY_PATH = "/fonts/solway-400-normal.woff2";
const FONT_FETCH_TIMEOUT_MS = 3000;

export type OgFontSource = {
  readonly origin: string;
  readonly assets?: CmsAssetsBinding | undefined;
};

const fontCache = new Map<string, ArrayBuffer>();

const loadFontBytes = (source: OgFontSource, path: string): Promise<Response> =>
  source.assets
    ? source.assets.fetch(`${source.origin}${path}`)
    : fetch(`${source.origin}${path}`, { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) });

export const fontFetchEffect = (source: OgFontSource, path: string) =>
  Effect.gen(function* () {
    const url = `${source.origin}${path}`;
    const cached = fontCache.get(url);
    if (cached !== undefined) return cached;

    const data = yield* Effect.tryPromise({
      try: () =>
        loadFontBytes(source, path).then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch font: ${res.status}`);
          }
          return res.arrayBuffer();
        }),
      catch: (cause) =>
        new FontFetchError({
          message: "Failed to fetch font",
          cause: Option.getOrElse(
            Option.map(
              Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }))(cause),
              (failure) => failure.message,
            ),
            () => "Unknown error",
          ),
        }),
    });

    fontCache.set(url, data);

    return data;
  }).pipe(Effect.withSpan("og.fetchFont"));

/**
 * Requester hostname for template auto-select. Substring matching would let
 * attacker domains like evil-sophie.st or sophie.st.evil.com steal another
 * site's template, so match exact hosts with a label boundary (the same
 * rule as the adapter origin allowlists).
 */
const requesterHostname = (requester: string): string => {
  const url = Schema.decodeUnknownOption(Schema.URLFromString)(requester);
  return Option.isSome(url) ? url.value.hostname.toLowerCase() : "";
};

export const getTemplate = (
  requester: string,
  templateParam?: OgTemplate,
): ((params: OgTemplateParams) => string) => {
  if (templateParam === "default") return OgTemplates.default;
  if (templateParam === "minimal") return OgTemplates.minimal;
  if (templateParam === "developer") return OgTemplates.developer;
  if (templateParam === "sophie") return OgTemplates.sophie;
  const hostname = requesterHostname(requester);
  if (hostname === "sophie.st" || hostname.endsWith(".sophie.st")) return OgTemplates.sophie;
  if (hostname === "dev.tom.so") return OgTemplates.developer;
  if (hostname === "tom.so" || hostname.endsWith(".tom.so")) return OgTemplates.default;
  return OgTemplates.minimal;
};

export const generateOgImageEffect = Effect.fn("og.generate")(function* (
  title: string,
  summary: string,
  requester: string,
  templateParam?: OgTemplate,
  date?: string,
  fontSource?: OgFontSource,
) {
  yield* Effect.logInfo("Generating OG image");
  const template = getTemplate(requester, templateParam);
  // Libre Caslon Condensed only serves the default template (minimal is
  // system-ui, developer is monospace); Solway only serves sophie. Fonts
  // load lazily from the worker's own origin so templates that never use
  // them never pay the fetch.
  const source = fontSource ?? { origin: "http://localhost:8787" };
  const fontData =
    template === OgTemplates.default ? yield* fontFetchEffect(source, LIBRE_CASLON_PATH) : null;
  const sophieFontData =
    template === OgTemplates.sophie ? yield* fontFetchEffect(source, SOLWAY_PATH) : null;

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
  if (Schema.is(FontFetchError)(error)) {
    return toProblemResponse(HttpStatus.BadGateway, error.message, {
      type: ProblemType.Upstream,
      detail: error.cause,
    });
  }
  if (Schema.is(ValidationError)(error)) {
    return toProblemResponse(HttpStatus.BadRequest, "Validation error", {
      type: ProblemType.Validation,
      detail: `${error.field} - ${error.issue}`,
      errors: [{ pointer: `#/${error.field}`, detail: error.issue }],
    });
  }
  return toProblemResponse(HttpStatus.InternalServerError, error.message);
};

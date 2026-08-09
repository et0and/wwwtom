import { Effect, Schema } from "effect";
import { ImageResponse } from "workers-og";
import { ogImageQueryParamsSchema } from "@tom/schemas/og";
import { OgTemplates, type OgTemplateParams } from "@tom/ui/OgImage";
import { FontFetchError, ValidationError, ImageGenerationError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { toErrorResponse } from "@tom/utils/services/worker";

const FONT_URL = "https://cdn.tom.so/LibreCaslonCondensed-Regular.ttf";

let cachedFontData: ArrayBuffer | null = null;

export const fontFetchEffect = Effect.gen(function* () {
  yield* Effect.logInfo("Fetching font");
  if (cachedFontData !== null) {
    yield* Effect.logInfo("Pulling cached font files");
    return cachedFontData;
  }

  const data = yield* Effect.tryPromise({
    try: () =>
      fetch(FONT_URL).then((res) => {
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

  cachedFontData = data;

  return data;
}).pipe(Effect.withSpan("og.fetchFont"));

export const getTemplate = (
  requester: string,
  templateParam?: string,
): ((params: OgTemplateParams) => string) => {
  if (templateParam && templateParam in OgTemplates) {
    return OgTemplates[templateParam as keyof typeof OgTemplates];
  }
  switch (true) {
    case requester.includes("tom.so"):
      return OgTemplates.default;
    case requester.includes("dev.tom.so"):
      return OgTemplates.developer;
    default:
      return OgTemplates.minimal;
  }
};

export const generateOgImageEffect = (
  title: string,
  summary: string,
  requester: string,
  templateParam?: string,
) =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Generating OG image");
    const fontData = yield* fontFetchEffect;
    const template = getTemplate(requester, templateParam);

    const html = template({ title, summary });

    return new ImageResponse(html, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Libre Caslon Condensed",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
    });
  }).pipe(Effect.withSpan("og.generate"));

export const validateOgParams = (title: string, summary: string) => {
  return Schema.decodeUnknownEffect(ogImageQueryParamsSchema)({
    title,
    summary,
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
    return toErrorResponse(HttpStatus.BadGateway, error.message, error.cause);
  }
  if (error instanceof ValidationError) {
    return toErrorResponse(
      HttpStatus.BadRequest,
      `Validation error: ${error.field} - ${error.issue}`,
    );
  }
  return toErrorResponse(HttpStatus.InternalServerError, error.message);
};

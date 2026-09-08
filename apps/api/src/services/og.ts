import { Effect, Schema } from "effect";
import { render } from "takumi-js";
import { fromHtml } from "takumi-js/helpers/html";
import { ogImageQueryParamsSchema, type OgTemplate } from "@tom/schemas/og";
import { OgTemplates, type OgTemplateParams } from "@tom/ui/OgImage";
import { ValidationError, ImageGenerationError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { toProblemResponse } from "@tom/utils/services/worker";
import { libreCaslonFontBytes, solwayFontBytes } from "./fonts.generated";

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
  // Fonts ship inside the worker bundle (see fonts.generated.ts) — no
  // runtime fetch. Libre Caslon Condensed only serves the default template
  // (minimal is system-ui, developer is monospace); Solway only serves
  // sophie.
  const fontData = template === OgTemplates.default ? libreCaslonFontBytes() : null;
  const sophieFontData = template === OgTemplates.sophie ? solwayFontBytes() : null;

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

export const handleOgError = (error: ValidationError | ImageGenerationError): Response => {
  if (error instanceof ValidationError) {
    return toProblemResponse(HttpStatus.BadRequest, "Validation error", {
      type: ProblemType.Validation,
      detail: `${error.field} - ${error.issue}`,
      errors: [{ pointer: `#/${error.field}`, detail: error.issue }],
    });
  }
  return toProblemResponse(HttpStatus.InternalServerError, error.message);
};

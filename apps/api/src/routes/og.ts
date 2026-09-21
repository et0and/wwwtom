import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { problemDetailsSchema } from "@tom/schemas/error";
import { commaTolerantString, joinCommaList } from "@tom/schemas/og";
import { ValidationError } from "@tom/types/errors";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
import { generateOgImageEffect, validateOgParams, handleOgError } from "../services/og";

const titleSchema = commaTolerantString(100).pipe(
  Schema.annotate({
    description: "Title text for the OG image",
    examples: ["Tom Hackshaw"],
    default: "Tom Hackshaw",
  }),
);

const summarySchema = commaTolerantString(200).pipe(
  Schema.annotate({
    description: "Summary/description text for the OG image",
    examples: ["Design engineer from Aotearoa New Zealand"],
    default: "Design engineer from Aotearoa New Zealand",
  }),
);

const dateSchema = commaTolerantString(30).pipe(
  Schema.annotate({
    description: "Date line for templates that render one (for example sophie)",
    examples: ["September 9, 2026"],
  }),
);

const templateSchema = Schema.optional(
  Schema.Union([Schema.Literal("default"), Schema.Literal("minimal"), Schema.Literal("sophie")]),
).pipe(
  Schema.annotate({
    description:
      "OG image template to use. Defaults to automatic selection based on requester. Available templates: default, minimal, sophie",
    examples: ["default"],
    default: "default",
  }),
);

const OgQuerySchema = Schema.Struct({
  title: titleSchema,
  summary: summarySchema,
  template: templateSchema,
  date: Schema.optional(dateSchema),
});

const ogQuerySchema = toOpenApiSchema(OgQuerySchema);

const imageResponseSchema = Schema.String.pipe(
  Schema.annotate({ description: "Generated OG image (PNG)" }),
);

const badRequestSchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Invalid query parameters" }),
);

const failedSchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Image generation failed" }),
);

const badGatewaySchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Font fetch failed" }),
);

export const ogRoutes = new Elysia({ name: "og" }).get(
  "/og",
  async ({ query, request }) => {
    const title = joinCommaList(query.title) || "Tom Hackshaw";
    const summary = joinCommaList(query.summary) || "Design engineer from Aotearoa New Zealand";
    const template = query.template;
    const date = joinCommaList(query.date);
    // Template auto-select reads the Referer header only: a ?requester=
    // override would let any caller force another site's template, so the
    // query param is not honored. An explicit template param stays
    // authoritative and is validated below. No Referer (the common crawler
    // case) resolves to the tenant's own brand card.
    const referer = request.headers.get("Referer") ?? "";

    const result = await runEffect(
      Effect.gen(function* () {
        const validated = yield* validateOgParams(title, summary, date, template);
        const env = getRequestEnv(request);
        return yield* generateOgImageEffect(
          title,
          summary,
          referer,
          validated.template,
          validated.date,
          {
            origin: new URL(request.url).origin,
            assets: env.ASSETS,
          },
          env.TENANT,
        );
      }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            if (Schema.is(ValidationError)(error)) {
              yield* Effect.logWarning("Error generating OG image", error);
            } else {
              yield* Effect.logError("Error generating OG image", error);
            }
            return handleOgError(error);
          }),
        ),
      ),
      logContextFromRequest(request, "tom-api"),
    );

    return result;
  },
  {
    query: ogQuerySchema,
    response: {
      200: toOpenApiSchema(imageResponseSchema),
      400: toOpenApiSchema(badRequestSchema),
      500: toOpenApiSchema(failedSchema),
      502: toOpenApiSchema(badGatewaySchema),
    },
    detail: {
      description: "OG image generation endpoint",
      tags: ["images"],
    },
  },
);

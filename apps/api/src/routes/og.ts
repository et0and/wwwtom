import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { problemDetailsSchema } from "@tom/schemas/error";
import { logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
import { generateOgImageEffect, validateOgParams, handleOgError } from "../services/og";

/**
 * OG text params are free text — titles and summaries legitimately contain
 * commas. Elysia's standard-schema query parser splits comma-separated
 * values into arrays, so accept the array form and rejoin it in the handler
 * (validateOgParams enforces the real length bounds on the joined value).
 */
const commaTolerantString = (maxLength: number) =>
  Schema.Union([
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(maxLength)),
    // Rejoined in the handler; validateOgParams enforces the real bounds on
    // the full joined value. Bounded (10 items of 300 chars) so repeated
    // params cannot pile up unbounded memory before the join.
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMaxLength(300)))).pipe(
      Schema.check(Schema.isMaxLength(10)),
    ),
  ]);

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
  Schema.Union([
    Schema.Literal("default"),
    Schema.Literal("minimal"),
    Schema.Literal("developer"),
    Schema.Literal("sophie"),
  ]),
).pipe(
  Schema.annotate({
    description:
      "OG image template to use. Defaults to automatic selection based on requester. Available templates: default, minimal, developer, sophie",
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

/** Rejoin the comma-split list form Elysia produces for text params. */
const joinCommaList = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value.join(",") : value;

export const ogRoutes = new Elysia({ name: "og" }).get(
  "/og",
  async ({ query, request, set }) => {
    const title = joinCommaList(query.title) || "Tom Hackshaw";
    const summary = joinCommaList(query.summary) || "Design engineer from Aotearoa New Zealand";
    const template = query.template;
    const date = joinCommaList(query.date);
    // Template auto-select reads the Referer header only: a ?requester=
    // override would let any caller force another site's template, so the
    // query param is not honored. An explicit template param stays
    // authoritative and is validated below.
    const referer = request.headers.get("Referer") ?? "";
    const requester = referer || "unknown";

    const result = await runEffect(
      Effect.gen(function* () {
        const validated = yield* validateOgParams(title, summary, date, template);
        return yield* generateOgImageEffect(
          title,
          summary,
          requester,
          validated.template,
          validated.date,
          new URL(request.url).origin,
        );
      }).pipe(
        Effect.catchTag("ValidationError", (error) =>
          Effect.logWarning("Error generating OG image", error).pipe(
            Effect.map(() => handleOgError(error)),
          ),
        ),
        Effect.catch((error) =>
          Effect.logError("Error generating OG image", error).pipe(
            Effect.map(() => handleOgError(error)),
          ),
        ),
      ),
      logContextFromRequest(request, "tom-api"),
    );

    if (result instanceof Response) {
      return result;
    }

    set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
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

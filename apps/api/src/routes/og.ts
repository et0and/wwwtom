import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { problemDetailsSchema } from "@tom/schemas/error";
import { ValidationError } from "@tom/types/errors";
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
    // the full joined value.
    Schema.Array(Schema.String),
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

const templateSchema = Schema.optional(
  Schema.Union([Schema.Literal("default"), Schema.Literal("minimal"), Schema.Literal("developer")]),
).pipe(
  Schema.annotate({
    description:
      "OG image template to use. Defaults to automatic selection based on requester. Available templates: default, minimal, developer",
    examples: ["default"],
    default: "default",
  }),
);

const requesterSchema = Schema.optional(Schema.String).pipe(
  Schema.annotate({
    description: "Site requesting the OG image",
    examples: ["https://tom.so"],
  }),
);

const OgQuerySchema = Schema.Struct({
  title: titleSchema,
  summary: summarySchema,
  template: templateSchema,
  requester: requesterSchema,
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
    const referer = request.headers.get("Referer") ?? "";
    const requester = referer || query.requester || "unknown";

    const result = await runEffect(
      Effect.gen(function* () {
        yield* validateOgParams(title, summary);
        return yield* generateOgImageEffect(title, summary, requester, template);
      }).pipe(
        Effect.catch((error) => {
          return Effect.gen(function* () {
            if (error instanceof ValidationError) {
              yield* Effect.logWarning("Error generating OG image", error);
            } else {
              yield* Effect.logError("Error generating OG image", error);
            }
            return yield* Effect.succeed(handleOgError(error));
          });
        }),
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

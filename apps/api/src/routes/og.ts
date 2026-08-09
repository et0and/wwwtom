import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { errorResponseSchema } from "@tom/schemas/error";
import { ValidationError } from "@tom/types/errors";
import { runEffect } from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
import { generateOgImageEffect, validateOgParams, handleOgError } from "../services/og";

// Param validation (length limits) happens in the OG service via @tom/schemas.
const titleSchema = Schema.optional(
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
).pipe(
  Schema.annotate({
    description: "Title text for the OG image",
    examples: ["Tom Hackshaw"],
    default: "Tom Hackshaw",
  }),
);

const summarySchema = Schema.optional(
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
).pipe(
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

const badRequestSchema = errorResponseSchema.pipe(
  Schema.annotate({ description: "Invalid query parameters" }),
);

const failedSchema = errorResponseSchema.pipe(
  Schema.annotate({ description: "Image generation failed" }),
);

const badGatewaySchema = errorResponseSchema.pipe(
  Schema.annotate({ description: "Font fetch failed" }),
);

export const ogRoutes = new Elysia({ name: "og" }).get(
  "/og",
  async ({ query, request, set }) => {
    const title = query.title || "Tom Hackshaw";
    const summary = query.summary || "Design engineer from Aotearoa New Zealand";
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

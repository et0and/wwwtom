import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { errorResponseSchema } from "@tom/schemas";
import { runEffect } from "@tom/utils/services";
import { generateOgImageEffect, validateOgParams, handleOgError } from "../services/og";

// Param validation (length limits) happens in the OG service via @tom/schemas.
const OgQuerySchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  template: Schema.optional(
    Schema.Union([
      Schema.Literal("default"),
      Schema.Literal("minimal"),
      Schema.Literal("developer"),
    ]),
  ),
  requester: Schema.optional(Schema.String),
});

const ogQuerySchema = Schema.toStandardSchemaV1(OgQuerySchema);

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
            yield* Effect.logError("Error generating OG image", error);
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
      200: Schema.toStandardSchemaV1(Schema.Unknown),
      400: Schema.toStandardSchemaV1(errorResponseSchema),
      500: Schema.toStandardSchemaV1(errorResponseSchema),
      502: Schema.toStandardSchemaV1(errorResponseSchema),
    },
    detail: {
      description: "OG image generation endpoint",
      tags: ["images"],
    },
  },
);

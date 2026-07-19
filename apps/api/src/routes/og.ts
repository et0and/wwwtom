import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { Effect } from "effect";
import { generateOgImageEffect, validateOgParams, handleOgError } from "../services/og";
import { runEffect } from "../config/effect";
import type { Env } from "../config/effect";

export const ogRoutes = new Hono<{ Bindings: Env }>();

ogRoutes.get(
  "/",
  describeRoute({
    description: "OG image generation endpoint",
    parameters: [
      {
        in: "query" as const,
        name: "title",
        required: false,
        schema: { type: "string", default: "Tom Hackshaw", maxLength: 100 },
        description: "Title text for the OG image",
        example: "Tom Hackshaw",
      },
      {
        in: "query" as const,
        name: "summary",
        required: false,
        schema: {
          type: "string",
          default: "Design engineer from Aotearoa New Zealand",
          maxLength: 200,
        },
        description: "Summary/description text for the OG image",
        example: "Design engineer from Aotearoa New Zealand",
      },
      {
        in: "query" as const,
        name: "template",
        required: false,
        schema: {
          type: "string",
          enum: ["default", "minimal", "developer"],
          default: "default",
        },
        description:
          "OG image template to use. Defaults to automatic selection based on requester. Available templates: default, minimal, developer",
        example: "default",
      },
    ],
    responses: {
      200: {
        description: "Image generated successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["success", "generatedAt"],
              properties: {
                success: { type: "boolean", enum: [true] },
                generatedAt: { type: "number" },
              },
            },
          },
        },
      },
      400: {
        description: "Invalid query parameters",
      },
      500: {
        description: "Image generation failed",
      },
    },
  }),
  async (c) => {
    const title = c.req.query("title") || "Tom Hackshaw";
    const summary = c.req.query("summary") || "Design engineer from Aotearoa New Zealand";
    const template = c.req.query("template") || undefined;
    const referer = c.req.header("Referer") || "";
    const requester = referer || c.req.query("requester") || "unknown";

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

    return result;
  },
);

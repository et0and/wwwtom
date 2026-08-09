import { Elysia } from "elysia";
import { Schema } from "effect";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { ImageGenerationError } from "@tom/types";
import { getRequestEnv, runEffect, toErrorResponse } from "@tom/utils/services";
import { callApi } from "../../callApi";

const OgQuerySchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
});

const ogQuerySchema = Schema.toStandardSchemaV1(OgQuerySchema);

export const ogIntegration = new Elysia({ name: "og" }).get(
  "/og",
  ({ query, request }) => {
    const env = getRequestEnv(request);
    const api = callApi(env.API_URL ?? "http://localhost:8787");

    const program = Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          api.og.get({
            query: {
              title: query.title,
              summary: query.summary,
              template: "default",
            },
            fetch: {
              cf: {
                cacheTtl: 31536000,
                cacheEverything: true,
              },
            } as RequestInit,
          }),
        catch: () => new ImageGenerationError({ message: "Failed to fetch OG image" }),
      });

      const response = result.response;
      if (!response.ok) {
        return yield* new ImageGenerationError({ message: "Failed to generate OG image" });
      }

      const imageBuffer = yield* Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: () => new ImageGenerationError({ message: "Failed to read image buffer" }),
      });

      return new Response(imageBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
          "CDN-Cache-Control": "public, max-age=31536000",
          "Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
        },
      });
    }).pipe(
      Effect.catch(
        Effect.fn("ogErrorHandler")(function* (error: ImageGenerationError) {
          yield* Effect.logError("OG image proxy error", error);
          return toErrorResponse(HttpStatus.InternalServerError, error.message);
        }),
      ),
    );

    return runEffect(program);
  },
  {
    query: ogQuerySchema,
    detail: {
      description: "OG image proxy — forwards to the Tom API and caches at the edge",
      tags: ["images"],
    },
  },
);

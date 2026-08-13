import { Elysia } from "elysia";
import { Schema } from "effect";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { ImageGenerationError } from "@tom/types/errors";
import { readCloudflareEnv } from "@tom/utils/services/config";
import {
  getRequestEnv,
  logContextFromRequest,
  runEffect,
  toErrorResponse,
} from "@tom/utils/services/worker";

const OgQuerySchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
});

const ogQuerySchema = Schema.toStandardSchemaV1(OgQuerySchema);

export const ogIntegration = new Elysia({ name: "og" }).get(
  "/og",
  async ({ query, request }) => {
    const env = await readCloudflareEnv(getRequestEnv(request));
    const apiUrl = env.API_URL ?? "http://localhost:8787";

    const program = Effect.gen(function* () {
      const params = new URLSearchParams();
      if (query.title) params.set("title", query.title);
      if (query.summary) params.set("summary", query.summary);
      params.set("template", "default");

      const headers = new Headers();
      if (env.INTERNAL_API_TOKEN) headers.set(INTERNAL_TOKEN_HEADER, env.INTERNAL_API_TOKEN);

      const response = yield* Effect.tryPromise({
        // A plain fetch, not the treaty client: the API answers with a PNG
        // and treaty consumes the body while parsing, so the image bytes
        // wouldn't be readable afterwards.
        try: () =>
          fetch(`${apiUrl}/og?${params}`, {
            headers,
            cf: {
              cacheTtl: 31536000,
              cacheEverything: true,
            },
          } as RequestInit),
        catch: () => new ImageGenerationError({ message: "Failed to fetch OG image" }),
      });

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

    return runEffect(program, logContextFromRequest(request, "tom-adapter"));
  },
  {
    query: ogQuerySchema,
    detail: {
      description: "OG image proxy — forwards to the Tom API and caches at the edge",
      tags: ["images"],
    },
  },
);

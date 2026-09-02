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
  toProblemResponse,
} from "@tom/utils/services/worker";
import { ProblemType } from "@tom/constants/problem";

/**
 * OG text is free text and legitimately contains commas ("Aotearoa, New
 * Zealand"). Elysia's standard-schema query parser splits comma-separated
 * values into arrays, so accept the array form and rejoin it before
 * forwarding (the API's validateOgParams enforces the real length bounds).
 */
const commaTolerantString = Schema.Union([Schema.String, Schema.Array(Schema.String)]);

const OgQuerySchema = Schema.Struct({
  title: Schema.optional(commaTolerantString),
  summary: Schema.optional(commaTolerantString),
});

const ogQuerySchema = Schema.toStandardSchemaV1(OgQuerySchema);

/** Rejoin the comma-split list form Elysia produces for text params. */
const joinCommaList = (value: string | readonly string[] | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(",") : (value as string);
};

export const ogIntegration = new Elysia({ name: "og" }).get(
  "/og",
  async ({ query, request }) => {
    const env = await readCloudflareEnv(getRequestEnv(request));
    const apiUrl = env.API_URL ?? "http://localhost:8787";
    const title = joinCommaList(query.title);
    const summary = joinCommaList(query.summary);

    const program = Effect.gen(function* () {
      const params = new URLSearchParams();
      if (title) params.set("title", title);
      if (summary) params.set("summary", summary);
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
          return toProblemResponse(HttpStatus.InternalServerError, error.message, {
            type: ProblemType.Upstream,
          });
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

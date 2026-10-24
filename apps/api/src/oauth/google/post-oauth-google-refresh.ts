import { Elysia } from "elysia";
import { Effect } from "effect";
import { logContextFromRequest, runEffect } from "@tom/utils/worker";
import { toOpenApiSchema } from "../../openapi";
import {
  decodeGoogleRefreshRequest,
  GoogleRefreshRequestSchema,
  GoogleTokenResponseSchema,
  refreshGoogleToken,
} from "./shared";

export const postOAuthGoogleRefreshRoute = new Elysia().post(
  "/oauth/google/refresh",
  ({ body, request }) =>
    runEffect(
      Effect.gen(function* () {
        const input = yield* decodeGoogleRefreshRequest(body);
        return yield* refreshGoogleToken(request, input);
      }),
      logContextFromRequest(request, "tom-api"),
    ),
  {
    body: toOpenApiSchema(GoogleRefreshRequestSchema),
    response: {
      200: toOpenApiSchema(GoogleTokenResponseSchema),
    },
    detail: {
      description: "Refresh a Google access token. The broker adds the server-side client secret.",
      tags: ["oauth"],
    },
  },
);

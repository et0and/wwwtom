import { Elysia } from "elysia";
import { Effect } from "effect";
import { logContextFromRequest, runEffect } from "@tom/utils/worker";
import { toOpenApiSchema } from "../../openapi";
import {
  decodeGoogleTokenRequest,
  exchangeGoogleCode,
  GoogleTokenRequestSchema,
  GoogleTokenResponseSchema,
} from "./shared";

export const postOAuthGoogleTokenRoute = new Elysia().post(
  "/oauth/google/token",
  ({ body, request }) =>
    runEffect(
      Effect.gen(function* () {
        const input = yield* decodeGoogleTokenRequest(body);
        return yield* exchangeGoogleCode(request, input);
      }),
      logContextFromRequest(request, "tom-api"),
    ),
  {
    body: toOpenApiSchema(GoogleTokenRequestSchema),
    response: {
      200: toOpenApiSchema(GoogleTokenResponseSchema),
    },
    detail: {
      description:
        "Exchange a Google authorization code and PKCE verifier. The broker adds the server-side client secret.",
      tags: ["oauth"],
    },
  },
);

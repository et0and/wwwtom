import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Schema } from "effect";
import {
  FetchHttpClient,
  Headers,
  HttpBody,
  HttpClient,
  HttpClientResponse,
} from "effect/unstable/http";

export class CredentialsError extends Schema.TaggedError<CredentialsError>()("CredentialsError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export type GtmCredentialsValue = {
  clientId: string;
  clientSecret: Redacted.Redacted;
  refreshToken: Redacted.Redacted;
};

export type GtmCredentialsService = {
  readonly value: GtmCredentialsValue;
  readonly getAccessToken: Effect.Effect<Redacted.Redacted, CredentialsError>;
};

export class GtmCredentials extends Context.Service<GtmCredentials, GtmCredentialsService>()(
  "GtmCredentials",
) {}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type TokenResponse = {
  token: Redacted.Redacted;
  expiresAt: number;
};

const TokenResponseSchema = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Number,
});

/**
 * HttpClient bound to the current global fetch. Built per call because the
 * Fetch reference default pins the first-seen implementation process-wide.
 */
const liveHttpClient = (): Layer.Layer<HttpClient.HttpClient> =>
  Layer.provideMerge(FetchHttpClient.layer, Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch));

const exchangeRefreshToken = (
  value: GtmCredentialsValue,
): Effect.Effect<TokenResponse, CredentialsError> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const requestBody = HttpBody.urlParams({
      client_id: value.clientId,
      client_secret: Redacted.value(value.clientSecret),
      refresh_token: Redacted.value(value.refreshToken),
      grant_type: "refresh_token",
    });
    const response = yield* client
      .post(TOKEN_ENDPOINT, {
        headers: Headers.fromInput({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: requestBody,
      })
      .pipe(
        Effect.mapError(
          (cause) => new CredentialsError({ message: "Token request failed", cause }),
        ),
      );
    const token = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.flatMap((okResponse) =>
        HttpClientResponse.schemaBodyJson(TokenResponseSchema)(okResponse),
      ),
      Effect.mapError((cause) => new CredentialsError({ message: "Token exchange failed", cause })),
    );
    return {
      token: Redacted.make(token.access_token),
      expiresAt: Date.now() + token.expires_in * 1000,
    };
  }).pipe(Effect.provide(liveHttpClient()));

/**
 * Refreshes Google OAuth access tokens, caching each token until shortly
 * before expiry and deduplicating concurrent refreshes. Cache state lives
 * per service instance (i.e. per stack run), not module-globally.
 */
const makeCredentialsService = (value: GtmCredentialsValue): GtmCredentialsService => {
  let cached: TokenResponse | undefined;
  let inFlight: Promise<TokenResponse> | undefined;

  const getAccessToken: Effect.Effect<Redacted.Redacted, CredentialsError> = Effect.suspend(() => {
    if (cached && Date.now() < cached.expiresAt - 60_000) {
      return Effect.succeed(cached.token);
    }
    if (!inFlight) {
      inFlight = Effect.runPromise(exchangeRefreshToken(value)).finally(() => {
        inFlight = undefined;
      });
    }
    const current = inFlight;
    return Effect.map(
      Effect.tryPromise({
        try: () => current,
        catch: (cause) =>
          new CredentialsError({
            message: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
      }),
      (response) => {
        cached = response;
        return response.token;
      },
    );
  });

  return { value, getAccessToken };
};

export const GtmCredentialsLive = Layer.effect(
  GtmCredentials,
  Effect.gen(function* () {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return yield* new CredentialsError({
        message:
          "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN must be set for GTM credentials",
      });
    }

    return makeCredentialsService({
      clientId,
      clientSecret: Redacted.make(clientSecret),
      refreshToken: Redacted.make(refreshToken),
    });
  }),
);

// Test helper: provide explicit credentials without env.
export const makeFakeGtmCredentialsLayer = (value: GtmCredentialsValue) =>
  Layer.succeed(GtmCredentials, makeCredentialsService(value));

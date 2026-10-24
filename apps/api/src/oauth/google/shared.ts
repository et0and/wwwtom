import { Effect, Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REQUEST_TIMEOUT_MS = 15_000;

const GoogleOAuthClientsSchema = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

export const GoogleTokenResponseSchema = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.optional(Schema.Finite),
  refresh_token: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.String),
  token_type: Schema.optional(Schema.String),
});

export type GoogleTokenResponse = Schema.Schema.Type<typeof GoogleTokenResponseSchema>;

const GoogleTokenResponseJsonSchema = Schema.fromJsonString(GoogleTokenResponseSchema);

export type GoogleTokenRequest = {
  readonly client_id: string;
  readonly code: string;
  readonly code_verifier: string;
  readonly redirect_uri: string;
};

export type GoogleRefreshRequest = {
  readonly client_id: string;
  readonly refresh_token: string;
};

export const GoogleTokenRequestSchema = Schema.Struct({
  client_id: Schema.String,
  code: Schema.String,
  code_verifier: Schema.String,
  redirect_uri: Schema.String,
});

export const GoogleRefreshRequestSchema = Schema.Struct({
  client_id: Schema.String,
  refresh_token: Schema.String,
});

const badRequest = (message: string): HttpError =>
  new HttpError({
    message,
    status: HttpStatus.BadRequest,
  });

const isLoopbackRedirect = (value: string): boolean => {
  const url = Schema.decodeOption(Schema.URLFromString)(value);
  return (
    Option.isSome(url) &&
    url.value.protocol === "http:" &&
    (url.value.hostname === "127.0.0.1" || url.value.hostname === "localhost")
  );
};

const resolveClientSecret = (request: Request, clientId: string) =>
  Effect.gen(function* () {
    const env = yield* Effect.tryPromise({
      try: () => readCloudflareEnv(getRequestEnv(request)),
      catch: (cause) =>
        new HttpError({
          message: "Google OAuth broker configuration is unavailable",
          status: HttpStatus.InternalServerError,
          cause,
        }),
    });
    const rawClients = env.GOOGLE_OAUTH_CLIENTS;
    if (rawClients === undefined || rawClients.trim() === "") {
      return yield* new HttpError({
        message: "Google OAuth broker is not configured",
        status: HttpStatus.InternalServerError,
      });
    }
    const clients = yield* Schema.decodeEffect(GoogleOAuthClientsSchema)(rawClients).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: "Google OAuth broker configuration is invalid",
            status: HttpStatus.InternalServerError,
            cause,
          }),
      ),
    );
    const secret = clients[clientId];
    if (secret === undefined || secret.trim() === "") {
      return yield* new HttpError({
        message: "Unknown Google OAuth client",
        status: HttpStatus.BadRequest,
      });
    }
    return secret;
  });

const postGoogleToken = (params: URLSearchParams): Effect.Effect<GoogleTokenResponse, HttpError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(GOOGLE_TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: params,
          signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
        }),
      catch: (cause) =>
        new HttpError({
          message: "Google token request failed",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) =>
        new HttpError({
          message: "Google token response could not be read",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new HttpError({
        message: "Google rejected the token request",
        status:
          response.status === HttpStatus.BadRequest ||
          response.status === HttpStatus.Unauthorized ||
          response.status === HttpStatus.Forbidden
            ? response.status
            : HttpStatus.BadGateway,
        cause: body.slice(0, 1000),
      });
    }
    return yield* Schema.decodeEffect(GoogleTokenResponseJsonSchema)(body).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: "Google returned an invalid token response",
            status: HttpStatus.BadGateway,
            cause,
          }),
      ),
    );
  });

export const exchangeGoogleCode = (
  request: Request,
  input: GoogleTokenRequest,
): Effect.Effect<GoogleTokenResponse, HttpError> =>
  Effect.gen(function* () {
    if (!isLoopbackRedirect(input.redirect_uri)) {
      return yield* badRequest("redirect_uri must be a loopback HTTP URL");
    }
    if (input.code.length === 0 || input.code_verifier.length < 43) {
      return yield* badRequest("invalid authorization code or PKCE verifier");
    }
    const clientSecret = yield* resolveClientSecret(request, input.client_id);
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.code_verifier,
      client_id: input.client_id,
      client_secret: clientSecret,
      redirect_uri: input.redirect_uri,
    });
    const token = yield* postGoogleToken(params);
    yield* Effect.logInfo("Google OAuth code exchanged", { clientId: input.client_id });
    return token;
  });

export const refreshGoogleToken = (
  request: Request,
  input: GoogleRefreshRequest,
): Effect.Effect<GoogleTokenResponse, HttpError> =>
  Effect.gen(function* () {
    if (input.refresh_token.length === 0) {
      return yield* badRequest("refresh_token is required");
    }
    const clientSecret = yield* resolveClientSecret(request, input.client_id);
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refresh_token,
      client_id: input.client_id,
      client_secret: clientSecret,
    });
    const token = yield* postGoogleToken(params);
    yield* Effect.logInfo("Google OAuth token refreshed", { clientId: input.client_id });
    return token;
  });

export const decodeGoogleTokenRequest = <B>(
  input: B,
): Effect.Effect<GoogleTokenRequest, HttpError> =>
  Schema.decodeUnknownEffect(GoogleTokenRequestSchema)(input).pipe(
    Effect.mapError(() => badRequest("invalid Google token request")),
  );

export const decodeGoogleRefreshRequest = <B>(
  input: B,
): Effect.Effect<GoogleRefreshRequest, HttpError> =>
  Schema.decodeUnknownEffect(GoogleRefreshRequestSchema)(input).pipe(
    Effect.mapError(() => badRequest("invalid Google refresh request")),
  );

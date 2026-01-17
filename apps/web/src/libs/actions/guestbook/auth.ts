import generator from "megalodon";
import { Effect, Redacted } from "effect";
import { retryPolicy, logger } from "@tom/utils";
import * as db from "~/libs/db/guestbook";
import { detector } from "./detector";
import {
  GuestbookValidationError,
  OAuthSessionError,
  AuthenticationError,
  HttpError,
} from "@tom/types";
import { HttpStatus } from "@tom/constants";

const REDIRECT_URI = Redacted.make(
  import.meta.env.PROD
    ? "https://tom.so/api/guestbook/callback"
    : "http://localhost:3000/api/guestbook/callback",
);

export interface FediverseUser {
  username: string;
  instance: string;
  display_name: string;
  avatar_url: string;
  access_token: string;
}

const generateSessionToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const generateState = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const initiateAuth = (fediverseHandle: string) =>
  Effect.gen(function* () {
    const parts = fediverseHandle.split("@").filter(Boolean);
    if (parts.length !== 2) {
      return yield* Effect.fail(
        new GuestbookValidationError({
          message:
            "Invalid fediverse handle format. Use: user@instance.social (without the leading @)",
          field: "fediverseHandle",
        }),
      );
    }

    const [_username, instance] = parts;
    const instanceUrl = `https://${instance}`;

    const snsType = yield* detector(instanceUrl).pipe(
      Effect.catchAll(() => Effect.succeed("mastodon" as const)),
    );

    const client = generator(snsType, instanceUrl);
    const state = generateState();

    const appData = yield* Effect.tryPromise({
      try: async () => {
        return await client.registerApp("Guestbook", {
          scopes: ["read:accounts"],
          redirect_uris: Redacted.value(REDIRECT_URI),
        });
      },
      catch: (error) => {
        logger.error("Megalodon registerApp error:", error);

        if (error && typeof error === "object" && "code" in error) {
          const code = (error as { code: string }).code;

          if (code === "ETIMEDOUT" || code === "ECONNABORTED") {
            return new HttpError({
              message: `Connection timeout trying to reach ${instance}. This might be a network/firewall issue on the server, or the instance may be down. Try a different instance like mastodon.social`,
              status: HttpStatus.GatewayTimeout,
            });
          }

          if (code === "ENOTFOUND") {
            return new HttpError({
              message: `Could not find ${instance}. Please check the instance name is correct.`,
              status: HttpStatus.NotFound,
            });
          }

          if (code === "ECONNREFUSED") {
            return new HttpError({
              message: `Connection refused by ${instance}. The instance may be down.`,
              status: HttpStatus.ServiceUnavailable,
            });
          }

          if (code === "ENETUNREACH") {
            return new HttpError({
              message: `Network unreachable for ${instance}. This is likely a server network configuration issue.`,
              status: HttpStatus.ServiceUnavailable,
            });
          }
        }

        if (error instanceof AggregateError) {
          const firstError = error.errors[0];
          if (firstError && "code" in firstError) {
            const code = (firstError as { code: string }).code;
            if (code === "ETIMEDOUT") {
              return new HttpError({
                message: `Connection timeout trying to reach ${instance}. The server cannot reach this instance. Try a different instance like mastodon.social or fosstodon.org`,
                status: HttpStatus.GatewayTimeout,
              });
            }
          }
        }

        return new HttpError({
          message: `Failed to connect to ${instance}. Please verify it's a valid Mastodon/Fediverse instance and try a well-known instance like mastodon.social`,
          status: HttpStatus.BadGateway,
        });
      },
    });

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    yield* db.createOAuthSession({
      session_token: sessionToken,
      fediverse_instance: instance ?? "",
      client_id: appData.client_id ?? "",
      client_secret: appData.client_secret ?? "",
      state: state,
      code_verifier: null,
      expires_at: expiresAt,
    });

    const authUrl = appData.url ?? "";
    if (!authUrl) {
      return yield* Effect.fail(
        new OAuthSessionError({
          message: `Failed to generate authorization URL for ${instance}. The instance may not support OAuth.`,
          sessionToken,
        }),
      );
    }

    return {
      authUrl,
      sessionToken,
      instance,
    };
  }).pipe(Effect.retry(retryPolicy));

export const handleCallback = (params: { code: string; session_token: string }) =>
  Effect.gen(function* () {
    const session = yield* db.getOAuthSession(params.session_token);

    if (!session) {
      return yield* Effect.fail(
        new OAuthSessionError({
          message: "Invalid or expired session",
          sessionToken: params.session_token,
        }),
      );
    }

    const instanceUrl = `https://${session.fediverse_instance}`;

    const snsType = yield* detector(instanceUrl).pipe(
      Effect.catchAll(() => Effect.succeed("mastodon" as const)),
    );

    const client = generator(snsType, instanceUrl);

    const tokenData = yield* Effect.tryPromise({
      try: async () =>
        client.fetchAccessToken(
          session.client_id,
          session.client_secret,
          params.code,
          Redacted.value(REDIRECT_URI),
        ),
      catch: (error) =>
        new AuthenticationError({
          message: `Failed to fetch access token: ${error}`,
        }),
    });

    const authedClient = generator(snsType, instanceUrl, tokenData.access_token);

    const account = yield* Effect.tryPromise({
      try: async () => authedClient.verifyAccountCredentials(),
      catch: (error) =>
        new AuthenticationError({
          message: `Failed to verify credentials: ${error}`,
        }),
    });

    yield* db.deleteOAuthSession(params.session_token);

    const user: FediverseUser = {
      username: account.data.acct,
      instance: session.fediverse_instance,
      display_name: account.data.display_name,
      avatar_url: account.data.avatar,
      access_token: tokenData.access_token,
    };

    return user;
  }).pipe(Effect.retry(retryPolicy));

export const signGuestbook = (params: { user: FediverseUser; message: string }) =>
  Effect.gen(function* () {
    const hasSigned = yield* db.hasUserSigned(`${params.user.username}@${params.user.instance}`);

    if (hasSigned) {
      return yield* Effect.fail(
        new GuestbookValidationError({
          message: "You have already signed the guestbook",
        }),
      );
    }

    const entry = yield* db.createGuestbookEntry({
      fediverse_username: `${params.user.username}@${params.user.instance}`,
      fediverse_instance: params.user.instance,
      display_name: params.user.display_name,
      avatar_url: params.user.avatar_url,
      message: params.message,
    });

    return entry;
  }).pipe(Effect.retry(retryPolicy));

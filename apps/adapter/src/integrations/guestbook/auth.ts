import generator from "megalodon";
import { Effect, Option, Schema } from "effect";
import { retryPolicy } from "@tom/utils/retry";
import { DatabaseService } from "@tom/db/service";
import { detector } from "./detector";
import {
  GuestbookValidationError,
  OAuthSessionError,
  AuthenticationError,
  HttpError,
} from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";

export const fediverseUserSchema = Schema.Struct({
  username: Schema.String,
  instance: Schema.String,
  display_name: Schema.String,
  avatar_url: Schema.String,
  access_token: Schema.String,
});

export type FediverseUser = Schema.Schema.Type<typeof fediverseUserSchema>;

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

const ErrorCodeBody = Schema.Struct({ code: Schema.String });

const readErrorCode = (cause: unknown): string | undefined =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(ErrorCodeBody)(cause), (parsed) => parsed.code),
    () => undefined,
  );

const initiateAuth_ = Effect.fn("initiateAuth")(function* (
  fediverseHandle: string,
  redirectUri: string,
) {
  const db = yield* DatabaseService;

  const parts = fediverseHandle.split("@").filter(Boolean);
  if (parts.length !== 2) {
    return yield* new GuestbookValidationError({
      message: "Invalid fediverse handle format. Use: user@instance.social (without the leading @)",
      field: "fediverseHandle",
    });
  }

  const [_username, instance] = parts;
  const instanceUrl = `https://${instance}`;

  const snsType = yield* detector(instanceUrl).pipe(
    Effect.catch(() => Effect.succeed("mastodon" as const)),
  );

  const client = generator(snsType, instanceUrl);
  const state = generateState();

  const mapRegisterAppError = Effect.fn("mapRegisterAppError")(function* (cause: unknown) {
    yield* Effect.logWarning("Megalodon registerApp error:", cause);

    const code = readErrorCode(cause);
    const nestedCode = cause instanceof AggregateError ? readErrorCode(cause.errors[0]) : undefined;

    if (code === "ETIMEDOUT" || code === "ECONNABORTED") {
      return yield* new HttpError({
        message: `Connection timeout trying to reach ${instance}. This might be a network/firewall issue on the server, or the instance may be down. Try a different instance like mastodon.social`,
        status: HttpStatus.GatewayTimeout,
      });
    }

    if (code === "ENOTFOUND") {
      return yield* new HttpError({
        message: `Could not find ${instance}. Please check the instance name is correct.`,
        status: HttpStatus.NotFound,
      });
    }

    if (code === "ECONNREFUSED") {
      return yield* new HttpError({
        message: `Connection refused by ${instance}. The instance may be down.`,
        status: HttpStatus.ServiceUnavailable,
      });
    }

    if (code === "ENETUNREACH") {
      return yield* new HttpError({
        message: `Network unreachable for ${instance}. This is likely a server network configuration issue.`,
        status: HttpStatus.ServiceUnavailable,
      });
    }

    if (nestedCode === "ETIMEDOUT") {
      return yield* new HttpError({
        message: `Connection timeout trying to reach ${instance}. The server cannot reach this instance. Try a different instance like mastodon.social or fosstodon.org`,
        status: HttpStatus.GatewayTimeout,
      });
    }

    return yield* new HttpError({
      message: `Failed to connect to ${instance}. Please verify it's a valid Mastodon/Fediverse instance and try a well-known instance like mastodon.social`,
      status: HttpStatus.BadGateway,
    });
  });

  const appData = yield* Effect.tryPromise(() =>
    client.registerApp("Guestbook", {
      scopes: ["read:accounts"],
      redirect_uris: redirectUri,
    }),
  ).pipe(Effect.catch(mapRegisterAppError));

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
    return yield* new OAuthSessionError({
      message: `Failed to generate authorization URL for ${instance}. The instance may not support OAuth.`,
      sessionToken,
    });
  }

  return {
    authUrl,
    sessionToken,
    instance,
  };
});

export const initiateAuth = (fediverseHandle: string, redirectUri: string) =>
  initiateAuth_(fediverseHandle, redirectUri).pipe(Effect.retry(retryPolicy));

const handleCallback_ = Effect.fn("handleCallback")(function* (params: {
  code: string;
  session_token: string;
  redirectUri: string;
}) {
  const db = yield* DatabaseService;
  const session = yield* db.getOAuthSession(params.session_token);

  if (!session) {
    return yield* new OAuthSessionError({
      message: "Invalid or expired session",
      sessionToken: params.session_token,
    });
  }

  const instanceUrl = `https://${session.fediverse_instance}`;

  const snsType = yield* detector(instanceUrl).pipe(
    Effect.catch(() => Effect.succeed("mastodon" as const)),
  );

  const client = generator(snsType, instanceUrl);

  const tokenData = yield* Effect.tryPromise({
    try: async () =>
      client.fetchAccessToken(
        session.client_id,
        session.client_secret,
        params.code,
        params.redirectUri,
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
});

export const handleCallback = (params: {
  code: string;
  session_token: string;
  redirectUri: string;
}) => handleCallback_(params).pipe(Effect.retry(retryPolicy));

const signGuestbook_ = Effect.fn("signGuestbook")(function* (params: {
  user: FediverseUser;
  message: string;
}) {
  const db = yield* DatabaseService;
  const hasSigned = yield* db.hasUserSigned(`${params.user.username}@${params.user.instance}`);

  if (hasSigned) {
    return yield* new GuestbookValidationError({
      message: "You have already signed the guestbook",
    });
  }

  const entry = yield* db.createGuestbookEntry({
    fediverse_username: `${params.user.username}@${params.user.instance}`,
    fediverse_instance: params.user.instance,
    display_name: params.user.display_name,
    avatar_url: params.user.avatar_url,
    message: params.message,
  });

  return entry;
});

export const signGuestbook = (params: { user: FediverseUser; message: string }) =>
  signGuestbook_(params).pipe(Effect.retry(retryPolicy));

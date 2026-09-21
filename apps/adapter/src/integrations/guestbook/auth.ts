import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from "effect";
import { DatabaseService } from "@tom/db/service";
import { toErrorMessage } from "@tom/utils/services/worker";
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

const randomHex = (byteLength: number) => {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const generateSessionToken = () => randomHex(32);

const generateState = () => randomHex(16);

/**
 * A `user@instance.social` handle split into its two parts. Decoding keeps
 * the previous split/filter semantics: segments around a single `@` with
 * nothing empty.
 */
const FediverseHandleSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Struct({ username: Schema.String, instance: Schema.String }), {
    decode: SchemaGetter.transformEffect((value: string, options) => {
      const parts = value.split("@").filter(Boolean);
      const [username, instance] = parts;
      if (parts.length !== 2 || username === undefined || instance === undefined) {
        return Effect.fail(new SchemaIssue.InvalidValue(undefined, value, options));
      }
      return Effect.succeed({ username, instance });
    }),
    encode: SchemaGetter.transform(
      (handle: { readonly username: string; readonly instance: string }) =>
        `${handle.username}@${handle.instance}`,
    ),
  }),
);

// Megalodon is only needed for Fediverse OAuth; load it lazily so the heavy
// client stays out of the adapter's cold-start module graph.
const loadGenerator = Effect.fn("loadMegalodon")(function* () {
  const mod = yield* Effect.tryPromise({
    try: () => import("megalodon"),
    catch: (cause) =>
      new HttpError({
        message: `Failed to load the fediverse client: ${toErrorMessage(cause)}`,
        status: HttpStatus.InternalServerError,
      }),
  });
  return mod.default;
});

const ErrorCodeBody = Schema.Struct({ code: Schema.String });

const readErrorCode = (cause: unknown): string | undefined =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(ErrorCodeBody)(cause), (parsed) => parsed.code),
    () => undefined,
  );

export const initiateAuth = Effect.fn("initiateAuth")(function* (
  fediverseHandle: string,
  redirectUri: string,
) {
  const db = yield* DatabaseService;

  const handle = yield* Schema.decodeEffect(FediverseHandleSchema)(fediverseHandle).pipe(
    Effect.mapError(
      () =>
        new GuestbookValidationError({
          message:
            "Invalid fediverse handle format. Use: user@instance.social (without the leading @)",
          field: "fediverseHandle",
        }),
    ),
  );
  const instance = handle.instance;
  const instanceUrl = `https://${instance}`;

  const snsType = yield* detector(instanceUrl).pipe(
    Effect.orElseSucceed(() => "mastodon" as const),
  );

  const generator = yield* loadGenerator();
  const client = generator(snsType, instanceUrl);
  const state = generateState();

  const mapRegisterAppError = Effect.fn("mapRegisterAppError")(function* (cause: unknown) {
    yield* Effect.logWarning("Megalodon registerApp error:", cause);

    const registerAppErrors: Record<string, { readonly status: number; readonly message: string }> =
      // oxlint-disable-next-line anti-slop/no-known-value-widening -- open lookup keyed by runtime error code
      {
        ETIMEDOUT: {
          status: HttpStatus.GatewayTimeout,
          message: `Connection timeout trying to reach ${instance}. This might be a network/firewall issue on the server, or the instance may be down. Try a different instance like mastodon.social`,
        },
        ECONNABORTED: {
          status: HttpStatus.GatewayTimeout,
          message: `Connection timeout trying to reach ${instance}. This might be a network/firewall issue on the server, or the instance may be down. Try a different instance like mastodon.social`,
        },
        ENOTFOUND: {
          status: HttpStatus.NotFound,
          message: `Could not find ${instance}. Please check the instance name is correct.`,
        },
        ECONNREFUSED: {
          status: HttpStatus.ServiceUnavailable,
          message: `Connection refused by ${instance}. The instance may be down.`,
        },
        ENETUNREACH: {
          status: HttpStatus.ServiceUnavailable,
          message: `Network unreachable for ${instance}. This is likely a server network configuration issue.`,
        },
      };

    const code = readErrorCode(cause);
    const direct = code === undefined ? undefined : registerAppErrors[code];
    if (direct !== undefined) {
      return yield* new HttpError({ message: direct.message, status: direct.status });
    }

    const nestedCode = cause instanceof AggregateError ? readErrorCode(cause.errors[0]) : undefined;
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
    fediverse_instance: instance,
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

export const handleCallback = Effect.fn("handleCallback")(function* (params: {
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
    Effect.orElseSucceed(() => "mastodon" as const),
  );

  const generator = yield* loadGenerator();
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

export const signGuestbook = Effect.fn("signGuestbook")(function* (params: {
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

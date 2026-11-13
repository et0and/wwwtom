import { SecureRandom } from "effect/crypto";
import { DateTime, Duration, Effect, Option, Schema, SchemaGetter, SchemaIssue } from "effect";
import { DatabaseService } from "@tom/db/service";
import { GuestbookUserSchema, type GuestbookUser } from "@tom/schemas/guestbook";
import { toErrorMessage } from "@tom/utils/worker";
import { detector } from "./detector";
import {
  GuestbookValidationError,
  OAuthSessionError,
  AuthenticationError,
  HttpError,
} from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";

/** The pending OAuth row expires quickly; it only spans one provider redirect. */
export const OAUTH_SESSION_TTL = Duration.minutes(15);

/** A signed-in guestbook session: long-lived, server-revoked on logout. */
export const GUESTBOOK_SESSION_TTL = Duration.days(30);

/** Cryptographically secure hex token of `byteLength` random bytes. */
const secureHex = (byteLength: number): Effect.Effect<string, never, SecureRandom.SecureRandom> =>
  Effect.gen(function* () {
    const random = yield* SecureRandom.SecureRandom;
    const bytes = yield* random.randomBytes(byteLength);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  });

/** A token plus the instant it stops being valid, read from one clock. */
const issueToken = (
  ttl: Duration.Duration,
): Effect.Effect<
  { readonly token: string; readonly expiresAt: Date },
  never,
  SecureRandom.SecureRandom
> =>
  Effect.gen(function* () {
    const [token, now] = yield* Effect.all([secureHex(32), DateTime.now], {
      concurrency: "unbounded",
    });
    return {
      token,
      expiresAt: DateTime.toDateUtc(DateTime.addDuration(now, ttl)),
    };
  });

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

/**
 * Start the provider leg: resolve the instance, register the app, and store a
 * pending OAuth row. The row carries the `state` the callback must see again,
 * so a callback minted for another browser cannot sign this one in.
 */
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

  // Nodeinfo detection, the client module, and the state token are
  // independent: one round-trip instead of three.
  const [snsType, generator, state] = yield* Effect.all(
    [
      detector(instanceUrl).pipe(Effect.orElseSucceed(() => "mastodon" as const)),
      loadGenerator(),
      secureHex(16),
    ],
    { concurrency: "unbounded" },
  );
  const client = generator(snsType, instanceUrl);

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

  const [sessionToken, expiresAt] = yield* Effect.all(
    [
      secureHex(32),
      DateTime.now.pipe(
        Effect.map((now) => DateTime.toDateUtc(DateTime.addDuration(now, OAUTH_SESSION_TTL))),
      ),
    ],
    { concurrency: "unbounded" },
  );

  yield* db.createOAuthSession({
    session_token: sessionToken,
    fediverse_instance: instance,
    client_id: appData.client_id ?? "",
    client_secret: appData.client_secret ?? "",
    state: state,
    code_verifier: null,
    expires_at: expiresAt,
  });

  const providerUrl = appData.url ?? "";
  if (!providerUrl) {
    return yield* new OAuthSessionError({
      message: `Failed to generate authorization URL for ${instance}. The instance may not support OAuth.`,
      sessionToken,
    });
  }

  // Megalodon builds the authorize URL without our state (some versions add
  // their own random one), so set the stored value explicitly: the callback
  // can only match a state this browser asked for.
  const authUrl = yield* Effect.try({
    try: () => {
      const url = new URL(providerUrl);
      url.searchParams.set("state", state);
      return url.toString();
    },
    catch: (cause) =>
      new OAuthSessionError({
        message: `Failed to build authorization URL for ${instance}`,
        sessionToken,
        cause,
      }),
  });

  return {
    authUrl,
    sessionToken,
    instance,
  };
});

export type CompletedAuth = {
  readonly user: GuestbookUser;
  readonly sessionToken: string;
};

/**
 * Finish the provider leg and open a server-side guestbook session.
 *
 * Both credentials must line up with the pending row: the cookie token names
 * the row, and the callback's `state` must equal the `state` stored when this
 * browser started the flow. A mismatch is a login-CSRF attempt, so the pending
 * row is deleted and the callback is rejected.
 */
export const completeAuth = Effect.fn("completeAuth")(function* (params: {
  code: string;
  state: string;
  session_token: string;
  redirectUri: string;
}) {
  const db = yield* DatabaseService;
  const pending = yield* db.getOAuthSession(params.session_token);

  if (!pending) {
    return yield* new OAuthSessionError({
      message: "Invalid or expired session",
      sessionToken: params.session_token,
    });
  }

  if (params.state === "" || pending.state !== params.state) {
    yield* db.deleteOAuthSession(params.session_token);
    yield* Effect.logWarning("guestbook:auth:callback:state-mismatch");
    return yield* new OAuthSessionError({
      message: "Invalid OAuth state",
      sessionToken: params.session_token,
    });
  }

  const instanceUrl = `https://${pending.fediverse_instance}`;

  const [snsType, generator] = yield* Effect.all(
    [detector(instanceUrl).pipe(Effect.orElseSucceed(() => "mastodon" as const)), loadGenerator()],
    { concurrency: "unbounded" },
  );
  const client = generator(snsType, instanceUrl);

  const tokenData = yield* Effect.tryPromise({
    try: async () =>
      client.fetchAccessToken(
        pending.client_id,
        pending.client_secret,
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

  // The pending provider row is single-use. Its token is never stored again.
  yield* db.deleteOAuthSession(params.session_token);

  const user: GuestbookUser = {
    username: account.data.acct,
    instance: pending.fediverse_instance,
    display_name: account.data.display_name,
    avatar_url: account.data.avatar,
  };

  const session = yield* issueToken(GUESTBOOK_SESSION_TTL);
  yield* db.createGuestbookSession({
    session_token: session.token,
    fediverse_username: `${user.username}@${user.instance}`,
    fediverse_instance: user.instance,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    expires_at: session.expiresAt,
  });

  return { user, sessionToken: session.token } satisfies CompletedAuth;
});

export { GuestbookUserSchema };

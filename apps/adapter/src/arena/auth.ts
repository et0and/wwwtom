import { Crypto } from "effect/Crypto";
import { DateTime, Duration, Effect, Redacted, Schema } from "effect";
import { ArenaClient } from "@tom/arena/client";
import { OAuth, generatePKCE, generateState } from "@aredotna/sdk/oauth";
import { DatabaseService } from "@tom/db/service";
import { AppConfig } from "@tom/utils/config";
import { toErrorMessage } from "@tom/utils/worker";
import { AuthenticationError, HttpError, OAuthSessionError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";

/** are.na scopes a comment needs: read the thread, write a comment. */
const ARENA_SCOPE = "read write";

/** How long a pending authorize → callback handshake may take. */
const SESSION_TTL_MINUTES = 15;

/** The signed-in are.na user as the web sees them — never the token. */
export const arenaAccountSchema = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  slug: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
});

/** Cryptographically secure hex token of `byteLength` random bytes. */
const secureHex = (byteLength: number): Effect.Effect<string, HttpError, Crypto> =>
  Effect.gen(function* () {
    const crypto = yield* Crypto;
    const bytes = yield* crypto.randomBytes(byteLength);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }).pipe(
    Effect.mapError(
      (cause) =>
        new HttpError({
          message: "Failed to generate a secure token",
          status: HttpStatus.InternalServerError,
          cause,
        }),
    ),
  );

const notConfigured = (): HttpError =>
  new HttpError({
    message: "are.na OAuth is not configured",
    status: HttpStatus.InternalServerError,
  });

const oauthClient = (clientId: string, redirectUri: string): OAuth =>
  new OAuth({ clientId, redirectUri });

/**
 * Start the are.na handshake: mint a PKCE pair and state, remember them under
 * a short-lived session token, and hand back the authorize URL the browser
 * should follow.
 */
export const initiateArenaAuth = Effect.fn("initiateArenaAuth")(function* (redirectUri: string) {
  const db = yield* DatabaseService;
  const config = yield* AppConfig;
  const clientId = config.arenaClientId;
  if (clientId === undefined) return yield* notConfigured();

  const { codeChallenge, codeVerifier } = yield* Effect.tryPromise({
    try: () => generatePKCE(),
    catch: (cause) =>
      new HttpError({
        message: "Failed to generate the PKCE pair",
        status: HttpStatus.InternalServerError,
        cause,
      }),
  });
  const state = generateState();
  const sessionToken = yield* secureHex(32);
  const expiresAt = yield* DateTime.now.pipe(
    Effect.map((now) =>
      DateTime.toDateUtc(DateTime.addDuration(now, Duration.minutes(SESSION_TTL_MINUTES))),
    ),
  );

  yield* db.createArenaOAuthSession({
    session_token: sessionToken,
    state,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  });

  const authUrl = oauthClient(clientId, redirectUri).authorizeUrl({
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
    scope: ARENA_SCOPE,
  });

  return { authUrl, sessionToken };
});

/**
 * Finish the handshake: verify the state, exchange the code for the
 * non-expiring are.na token, read the account, and store the token behind a
 * fresh opaque session id. are.na tokens are long-lived, so the browser only
 * ever holds the id.
 */
export const handleArenaCallback = Effect.fn("handleArenaCallback")(function* (params: {
  code: string;
  state: string | undefined;
  sessionToken: string;
  redirectUri: string;
}) {
  const db = yield* DatabaseService;
  const config = yield* AppConfig;
  const clientId = config.arenaClientId;
  if (clientId === undefined) return yield* notConfigured();

  const session = yield* db.getArenaOAuthSession(params.sessionToken);
  if (!session) {
    return yield* new OAuthSessionError({
      message: "Invalid or expired session",
      sessionToken: params.sessionToken,
    });
  }

  const clientSecret =
    config.arenaClientSecret === undefined ? undefined : Redacted.value(config.arenaClientSecret);

  const token = yield* Effect.tryPromise({
    try: () =>
      oauthClient(clientId, params.redirectUri).exchangeCode({
        code: params.code,
        codeVerifier: session.code_verifier,
        redirectUri: params.redirectUri,
        expectedState: session.state,
        ...(params.state !== undefined && { state: params.state }),
        ...(clientSecret !== undefined && { clientSecret }),
      }),
    catch: (cause) =>
      new AuthenticationError({
        message: `Failed to exchange the are.na code: ${toErrorMessage(cause)}`,
      }),
  });

  const me = yield* new ArenaClient({ token: token.access_token }).me;

  const sessionId = yield* secureHex(32);
  yield* db.upsertArenaAccount({
    session_id: sessionId,
    arena_user_id: me.id,
    arena_user_slug: me.slug,
    arena_user_name: me.name,
    arena_user_avatar_url: me.avatar,
    access_token: token.access_token,
  });
  yield* db.deleteArenaOAuthSession(params.sessionToken);

  // Only the session id leaves here: the web re-reads /arena/me after the
  // redirect, so there is nothing else to hand back.
  return { sessionId };
});

/** The signed-in are.na user for a session id, or null when it is unknown. */
export const arenaAccountForSession = Effect.fn("arenaAccountForSession")(function* (
  sessionId: string,
) {
  const db = yield* DatabaseService;
  return yield* db.getArenaAccountProfile(sessionId);
});

/** The stored are.na token for a session id, or null when it is unknown. */
export const arenaTokenForSession = Effect.fn("arenaTokenForSession")(function* (
  sessionId: string,
) {
  const db = yield* DatabaseService;
  return yield* db.getArenaAccessToken(sessionId);
});

/** Forget a session: the stored are.na token is dropped with its row. */
export const signOutArena = Effect.fn("signOutArena")(function* (sessionId: string) {
  const db = yield* DatabaseService;
  yield* db.deleteArenaAccount(sessionId);
});

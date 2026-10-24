import { Effect, Redacted } from "effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiSecurity from "effect/unstable/httpapi/HttpApiSecurity";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

/** The caller Git acts as: the Better Auth user id, lowercased. */
export type GitUser = {
  readonly id: string;
};

/**
 * The slice of Better Auth the credential check needs. The real instance
 * satisfies this structurally, and tests can fake it.
 */
export interface GitCredentialSource {
  readonly api: {
    verifyApiKey(input: { readonly body: { readonly key: string } }): Promise<{
      readonly valid: boolean;
      readonly key: { readonly referenceId: string } | null;
    }>;
    getSession(input: { readonly headers: Headers }): Promise<{
      readonly user: { readonly id: string };
    } | null>;
  };
}

/**
 * Resolve the caller from a Git API key (HTTP Basic password) or a Better
 * Auth session cookie. An invalid or absent credential resolves to `null`,
 * so callers cannot tell a bad key from no key.
 */
export const resolveGitUser = (
  auth: GitCredentialSource,
): Effect.Effect<
  GitUser | null,
  never,
  HttpServerRequest.HttpServerRequest | HttpServerRequest.ParsedSearchParams
> =>
  Effect.gen(function* () {
    const { password } = yield* HttpApiBuilder.securityDecode(HttpApiSecurity.basic);
    const key = Redacted.value(password);
    if (key !== "") {
      const verified = yield* Effect.tryPromise(() =>
        auth.api.verifyApiKey({ body: { key } }),
      ).pipe(Effect.catch(() => Effect.succeed(null)));
      return verified !== null && verified.valid && verified.key !== null
        ? { id: verified.key.referenceId.toLowerCase() }
        : null;
    }

    const request = yield* HttpServerRequest.HttpServerRequest;
    const headers = new globalThis.Headers(Object.entries(request.headers));
    const session = yield* Effect.tryPromise(() => auth.api.getSession({ headers })).pipe(
      Effect.catch(() => Effect.succeed(null)),
    );
    return session !== null ? { id: session.user.id.toLowerCase() } : null;
  });

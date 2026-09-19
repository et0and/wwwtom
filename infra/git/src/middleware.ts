import { RuntimeContext } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { createGitAuthFromEnv, type GitEnv } from "./auth.ts";
import { resolveGitUser } from "./credentials.ts";

/**
 * Every Git route needs an authenticated caller: an allowlisted GitHub
 * session cookie, or a per-user API key as the HTTP Basic password. The env
 * object is captured at worker init and read per request, when bindings are
 * populated.
 */
export const Authentication = HttpRouter.middleware(
  Effect.gen(function* () {
    const env: GitEnv = yield* Cloudflare.WorkerEnvironment;
    return (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const auth = yield* createGitAuthFromEnv(env, new URL(request.url).origin).pipe(
          Effect.catch((error) =>
            Effect.logError(`Git auth is not configured: ${error.message}`).pipe(Effect.as(null)),
          ),
        );
        if (auth === null) {
          return HttpServerResponse.empty({ status: 500 });
        }
        const user = yield* resolveGitUser(auth);
        if (user === null) {
          return HttpServerResponse.empty({
            status: 401,
            headers: { "www-authenticate": 'Basic realm="git"' },
          });
        }
        return yield* httpEffect;
      }).pipe(Effect.provide(RuntimeContext.phantom));
  }),
);

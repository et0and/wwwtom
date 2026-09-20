import { ALCHEMY_DEV, Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Git from "alchemy/Git";
import * as Http from "alchemy/Http";
import { Effect, Layer, Option, Schema } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { createGitAuthFromEnv, GitAuthDb, type GitEnv } from "./auth.ts";
import { GitLive } from "./git.ts";
import { homePage } from "./home.ts";

/**
 * Plain vars for `alchemy dev`: Secrets Store bindings are unsupported in
 * local workerd mode, so the deploy-time bundle is split into the four keys
 * the Git host reads.
 */
const resolveDevSecrets = (): Record<string, string> => {
  const bundle = process.env.TOM_SECRETS;
  if (bundle === undefined) return {};
  const parsed = Option.getOrElse(
    Schema.decodeUnknownOption(TomSecretsSchema)(bundle),
    (): Record<string, string> => ({}),
  );
  const entries: ReadonlyArray<readonly [string, string | undefined]> = [
    ["GITHUB_CLIENT_ID", parsed.GITHUB_CLIENT_ID],
    ["GITHUB_CLIENT_SECRET", parsed.GITHUB_CLIENT_SECRET],
    ["BETTER_AUTH_SECRET", parsed.TOM_BETTER_AUTH_SECRET ?? parsed.BETTER_AUTH_SECRET],
    ["CMS_ADMIN_EMAILS", parsed.TOM_CMS_ADMIN_EMAILS ?? parsed.CMS_ADMIN_EMAILS],
  ];
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
};

/** Bindings + secrets the Git host needs. Production rides TOM_SECRETS. */
const gitEnv = Effect.gen(function* () {
  const isAlchemyDev = yield* ALCHEMY_DEV;
  if (isAlchemyDev) {
    return { TENANT: "tom", GIT_AUTH_D1: GitAuthDb, ...resolveDevSecrets() };
  }
  return {
    TENANT: "tom",
    GIT_AUTH_D1: GitAuthDb,
    TOM_SECRETS: yield* Cloudflare.SecretsStore.Secret.ref("TOM_SECRETS", {
      stack: "wwwtom",
    }),
  };
});

const gitName = Effect.gen(function* () {
  const stage = yield* Stage;
  return stage === "production" ? "wwwtom-git" : `wwwtom-git-${stage}`;
});

const gitDomain = Effect.gen(function* () {
  const stage = yield* Stage;
  return stage === "production" ? "git.tom.so" : `${stage}-git.tom.so`;
});

export default class GitHost extends Cloudflare.Worker<GitHost>()(
  "GitHost",
  {
    main: import.meta.url,
    ...Git.GIT_WORKER_OPTIONS,
    name: gitName,
    domain: gitDomain,
    dev: {
      // Local workerd dev server via `alchemy dev`; GitHub OAuth callbacks
      // must include http://localhost:8790/api/auth/callback/github.
      port: 8790,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    env: Effect.map(gitEnv, (resolved) => ({
      ...Git.GIT_WORKER_OPTIONS.env,
      ...resolved,
    })),
  },
  Effect.gen(function* () {
    const env: GitEnv = yield* Cloudflare.WorkerEnvironment;
    const git = yield* HttpRouter.toHttpEffect(GitLive.pipe(Layer.provide(Http.Platform)));
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const path = new URL(request.url).pathname;
        if (request.method === "GET" && path === "/") {
          return homePage();
        }
        // Sign-in must be reachable before a caller has a session.
        if (path === "/api/auth" || path.startsWith("/api/auth/")) {
          const auth = yield* createGitAuthFromEnv(env, new URL(request.url).origin).pipe(
            Effect.catch((error) =>
              Effect.logError(`Git auth is not configured: ${error.message}`).pipe(Effect.as(null)),
            ),
          );
          if (auth === null) {
            return HttpServerResponse.empty({ status: 500 });
          }
          const source: object = request.source;
          if (!(source instanceof Request)) {
            return HttpServerResponse.empty({ status: 500 });
          }
          const response = yield* Effect.tryPromise(() => auth.handler(source)).pipe(
            Effect.catch((cause) => Effect.logError(cause).pipe(Effect.as(null))),
          );
          return response === null
            ? HttpServerResponse.empty({ status: 500 })
            : HttpServerResponse.fromWeb(response);
        }
        return yield* git;
      }),
    };
  }),
) {}

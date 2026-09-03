import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { GitHubApiError, RunnerError } from "@tom/types/errors";
import { logLevelFromEnv, otelConfigFromResolvedEnv } from "@tom/utils/services/logging";
import { readCloudflareEnv, type CloudflareEnv } from "@tom/utils/services/config";
import {
  attachRequestContext,
  logContextFromRequest,
  runEffect,
  sendErrorAlert,
  toErrorMessage,
  toProblemResponse,
} from "@tom/utils/services/worker";

// The container-backed DO class this Worker hosts. The stack binds it via
// `Cloudflare.Container("Sandbox", …)`; className defaults to the binding
// name, so the exported class must be named Sandbox.

export type RunnerEnv = CloudflareEnv & {
  readonly Sandbox: DurableObjectNamespace<Sandbox>;
  readonly GITHUB_REPOSITORY: string;
  readonly RUNNER_LABELS: string;
  // GITHUB_TOKEN / CONTROL_TOKEN are merged in from the TOM_SECRETS bundle
  // by readCloudflareEnv and validated at the boundary by RunnerSecrets.
  readonly GITHUB_TOKEN?: string;
  readonly CONTROL_TOKEN?: string;
};

/**
 * The runner's secret contract, parsed once per request at the env boundary.
 * CONTROL_TOKEN guards the control endpoints; GITHUB_TOKEN is the fine-grained
 * PAT used to mint runner registration tokens.
 */
const RunnerSecrets = Schema.Struct({
  GITHUB_TOKEN: Schema.String.check(Schema.isMinLength(1)),
  CONTROL_TOKEN: Schema.String.check(Schema.isMinLength(32)),
});

type RunnerSecrets = Schema.Schema.Type<typeof RunnerSecrets>;

const RUNNER_READY = /Listening for Jobs/i;
const RUNNER_ID_PATTERN =
  /^runner-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/;

const RegistrationTokenResponse = Schema.Struct({
  token: Schema.String,
  expires_at: Schema.String,
});

type RegistrationToken = Schema.Schema.Type<typeof RegistrationTokenResponse>;

const parseRunnerSecrets = (env: CloudflareEnv): Effect.Effect<RunnerSecrets, RunnerError> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(RunnerSecrets)(env),
    catch: (cause) => new RunnerError({ message: "Runner secrets are invalid", cause }),
  });

/**
 * Constant-time byte comparison of two same-length buffers (WebCrypto has no
 * timingSafeEqual on Workers).
 */
const constantTimeEqual = (a: ArrayBuffer, b: ArrayBuffer): boolean => {
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
};

const secureEqual = (provided: string, expected: string): Effect.Effect<boolean, RunnerError> =>
  Effect.gen(function* () {
    const digest = (value: string) =>
      Effect.tryPromise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    const [providedHash, expectedHash] = yield* Effect.all([
      digest(provided),
      digest(expected),
    ]).pipe(
      Effect.mapError((cause) => new RunnerError({ message: "Timing-safe compare failed", cause })),
    );
    return constantTimeEqual(providedHash, expectedHash);
  });

const authenticate = (
  request: Request,
  expectedToken: string,
): Effect.Effect<boolean, RunnerError> => {
  if (expectedToken.length < 32) return Effect.succeed(false);
  const authorization = request.headers.get("Authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  return secureEqual(providedToken, expectedToken);
};

const createCleanupToken = (
  sandboxId: string,
  controlToken: string,
): Effect.Effect<string, RunnerError> =>
  Effect.gen(function* () {
    const key = yield* Effect.tryPromise(() =>
      crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(controlToken),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
    ).pipe(
      Effect.mapError((cause) => new RunnerError({ message: "HMAC key import failed", cause })),
    );

    const signature = yield* Effect.tryPromise(() =>
      crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sandboxId)),
    ).pipe(Effect.mapError((cause) => new RunnerError({ message: "HMAC signing failed", cause })));

    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  });

const createRegistrationToken = (
  repository: string,
  githubToken: string,
): Effect.Effect<RegistrationToken, GitHubApiError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`https://api.github.com/repos/${repository}/actions/runners/registration-token`, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubToken}`,
            "User-Agent": "cloudflare-sandbox-actions-runner",
            "X-GitHub-Api-Version": "2026-03-10",
          },
        }),
      catch: (cause) =>
        new GitHubApiError({ message: "GitHub registration-token request failed", cause }),
    });

    if (!response.ok) {
      const body = response.body;
      if (body) {
        yield* Effect.tryPromise(() => body.cancel()).pipe(Effect.ignore);
      }
      return yield* new GitHubApiError({
        message: `GitHub registration-token request failed: ${response.status}`,
        status: response.status,
      });
    }

    const raw = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new GitHubApiError({
          message: "GitHub returned an invalid registration-token response",
          cause,
        }),
    });

    return yield* Effect.try({
      try: () => Schema.decodeUnknownSync(RegistrationTokenResponse)(raw),
      catch: () =>
        new GitHubApiError({ message: "GitHub returned an invalid registration-token response" }),
    });
  });

const startRunner = (
  env: RunnerEnv,
  secrets: RunnerSecrets,
  origin: string,
): Effect.Effect<
  { expiresAt: string; runnerName: string; sandboxId: string },
  RunnerError | GitHubApiError
> =>
  Effect.gen(function* () {
    if (!REPOSITORY_PATTERN.test(env.GITHUB_REPOSITORY)) {
      return yield* new RunnerError({
        message: "GITHUB_REPOSITORY must use the OWNER/REPO format",
      });
    }

    const registration = yield* createRegistrationToken(
      env.GITHUB_REPOSITORY,
      secrets.GITHUB_TOKEN,
    );
    const id = crypto.randomUUID();
    const runnerName = `cloudflare-${id}`;
    const sandboxId = `runner-${id}`;
    const cleanupToken = yield* createCleanupToken(sandboxId, secrets.CONTROL_TOKEN);

    const sandbox = getSandbox(env.Sandbox, sandboxId, {
      enableDefaultSession: false,
      keepAlive: true,
      normalizeId: true,
      transport: "rpc",
      labels: {
        repository: env.GITHUB_REPOSITORY,
        workload: "github-actions-runner",
      },
    });

    // Start the runner process and wait for GitHub to accept it. On any
    // failure the sandbox is destroyed so a half-started runner can't keep
    // an instance alive.
    yield* Effect.tryPromise({
      try: async () => {
        const process = await sandbox.startProcess("/usr/local/bin/run-actions-runner", {
          processId: "actions-runner",
          autoCleanup: false,
          env: {
            ACTIONS_RUNNER_PRINT_LOG_TO_STDOUT: "1",
            DOCKER_HOST: "unix:///run/user/1001/docker.sock",
            HOME: "/home/runner",
            LOGNAME: "runner",
            RUNNER_CLEANUP_TOKEN: cleanupToken,
            RUNNER_CLEANUP_URL: `${origin}/runners/${sandboxId}`,
            RUNNER_LABELS: env.RUNNER_LABELS,
            RUNNER_NAME: runnerName,
            RUNNER_TOKEN: registration.token,
            RUNNER_URL: `https://github.com/${env.GITHUB_REPOSITORY}`,
            USER: "runner",
            XDG_RUNTIME_DIR: "/run/user/1001",
          },
        });
        await process.waitForLog(RUNNER_READY, 120_000);
      },
      catch: (cause) => new RunnerError({ message: "Failed to start ephemeral runner", cause }),
    }).pipe(
      Effect.catch((error) =>
        Effect.tryPromise(() => sandbox.destroy()).pipe(
          Effect.catch(() => Effect.void),
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    );

    yield* Effect.logInfo("ephemeral runner ready", {
      repository: env.GITHUB_REPOSITORY,
      runnerName,
      sandboxId,
    });

    return { expiresAt: registration.expires_at, runnerName, sandboxId };
  });

const destroyRunner = (env: RunnerEnv, sandboxId: string): Effect.Effect<void, RunnerError> =>
  Effect.gen(function* () {
    const sandbox = getSandbox(env.Sandbox, sandboxId, {
      enableDefaultSession: false,
      normalizeId: true,
      transport: "rpc",
    });

    yield* Effect.tryPromise(() => sandbox.destroy()).pipe(
      Effect.mapError(
        (cause) => new RunnerError({ message: "Failed to destroy runner sandbox", cause }),
      ),
    );

    yield* Effect.logInfo("destroyed completed ephemeral runner", { sandboxId });
  });

const handleRequest = (
  request: Request,
  env: RunnerEnv,
  secrets: RunnerSecrets,
): Effect.Effect<Response, RunnerError> =>
  Effect.gen(function* () {
    const url = yield* Effect.try({
      // Effect.try is the Effect-idiomatic try/catch; request.url is platform-valid.
      // pi-lens-ignore: unchecked-throwing-call
      try: () => new URL(request.url),
      catch: (cause) => new RunnerError({ message: "Invalid request URL", cause }),
    });

    const cleanupSandboxId = url.pathname.startsWith("/runners/")
      ? url.pathname.slice("/runners/".length)
      : "";
    const isCleanupRequest =
      request.method === "DELETE" && RUNNER_ID_PATTERN.test(cleanupSandboxId);

    // The image calls this back after the runner exits so the sandbox is
    // destroyed. The bearer token is the HMAC of the sandbox id, so only the
    // sandbox itself (and anyone holding CONTROL_TOKEN) can trigger cleanup.
    if (isCleanupRequest) {
      const cleanupToken = yield* createCleanupToken(cleanupSandboxId, secrets.CONTROL_TOKEN);
      const authorized = yield* authenticate(request, cleanupToken);
      if (!authorized) {
        return toProblemResponse(HttpStatus.Unauthorized, "Unauthorized", {
          type: ProblemType.Unauthorized,
        });
      }

      yield* destroyRunner(env, cleanupSandboxId);
      return new Response(null, { status: HttpStatus.NoContent });
    }

    if (url.pathname !== "/runners") {
      return toProblemResponse(HttpStatus.NotFound, "Not found", {
        type: ProblemType.NotFound,
      });
    }
    if (request.method !== "POST") {
      return toProblemResponse(HttpStatus.MethodNotAllowed, "Method not allowed");
    }

    const authorized = yield* authenticate(request, secrets.CONTROL_TOKEN);
    if (!authorized) {
      return toProblemResponse(HttpStatus.Unauthorized, "Unauthorized", {
        type: ProblemType.Unauthorized,
      });
    }

    return yield* startRunner(env, secrets, url.origin).pipe(
      Effect.map((runner) => Response.json(runner, { status: HttpStatus.Accepted })),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* Effect.logError("failed to start ephemeral runner", {
            error: toErrorMessage(error),
            repository: env.GITHUB_REPOSITORY,
          });
          return toProblemResponse(HttpStatus.BadGateway, "Failed to start runner", {
            type: ProblemType.Upstream,
            detail: toErrorMessage(error),
          });
        }),
      ),
    );
  });

const handleRequestWithAlerts = (
  request: Request,
  env: RunnerEnv,
): Effect.Effect<Response, never> =>
  parseRunnerSecrets(env).pipe(
    Effect.flatMap((secrets) => handleRequest(request, env, secrets)),
    Effect.catch((cause) =>
      Effect.gen(function* () {
        yield* Effect.logError("unhandled runner error", { error: toErrorMessage(cause) });
        yield* Effect.sync(() => {
          sendErrorAlert(env, "Unhandled runner error", cause);
        });
        return toProblemResponse(HttpStatus.InternalServerError, "Internal server error");
      }),
    ),
  );

const worker = {
  fetch: async (request: Request, rawEnv: RunnerEnv): Promise<Response> => {
    // Resolve the TOM_SECRETS bundle into plain env vars (GITHUB_TOKEN,
    // CONTROL_TOKEN, telegram alert vars) and the AXIOM_TOKEN Secrets Store
    // binding before anything else. The spread preserves the Sandbox
    // binding and the plain vars.
    const resolvedEnv = await readCloudflareEnv(rawEnv);
    const env = resolvedEnv as RunnerEnv;

    const requestId = crypto.randomUUID();
    const otel = otelConfigFromResolvedEnv(resolvedEnv);
    attachRequestContext(request, {
      requestId,
      logLevel: logLevelFromEnv(env),
      ...(otel && { otel }),
    });

    return runEffect(
      handleRequestWithAlerts(request, env),
      logContextFromRequest(request, "wwwtom-runner"),
    );
  },
};

export default worker;

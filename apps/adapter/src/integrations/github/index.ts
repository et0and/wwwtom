import { Elysia } from "elysia";
import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { logApiFailure, runEffect } from "@tom/utils/services/worker";

const GITHUB_HEADERS = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "wwwtom-version-endpoint",
};

const fetchGithubJson = <T>(url: string): Effect.Effect<T, HttpError> =>
  Effect.tryPromise({
    try: () => fetch(url, { headers: GITHUB_HEADERS }),
    catch: (error) =>
      new HttpError({
        message: error instanceof Error ? error.message : "Failed to fetch from GitHub",
        status: 0,
      }),
  }).pipe(
    Effect.flatMap((response) => {
      if (!response.ok) {
        return Effect.fail(
          new HttpError({
            message: `GitHub API error: ${response.status}`,
            status: response.status,
          }),
        );
      }
      return Effect.tryPromise({
        try: () => response.json() as Promise<T>,
        catch: (error) =>
          new HttpError({
            message: error instanceof Error ? error.message : "Failed to parse GitHub response",
            status: 0,
          }),
      });
    }),
  );

const getLatestCommitHash = Effect.fn("getLatestCommitHash")(function* () {
  const data = yield* fetchGithubJson<{ sha?: string }>(
    "https://api.github.com/repos/et0and/wwwtom/commits/dev",
  );
  return data.sha ?? "unknown";
});

const getLatestCommitHashWithFallback = () =>
  getLatestCommitHash().pipe(
    Effect.catch(
      Effect.fn("getLatestCommitHashErrorHandler")(function* (error: HttpError) {
        yield* logApiFailure("Failed to fetch commit from GitHub API", error.status, error);
        return yield* Effect.succeed("unknown");
      }),
    ),
  );

const getLatestVersion = Effect.fn("getLatestVersion")(function* () {
  const data = yield* fetchGithubJson<Array<{ name?: string }>>(
    "https://api.github.com/repos/et0and/wwwtom/tags",
  );
  const latestTag = data[0];
  if (!latestTag?.name) return "0.0.0";
  return latestTag.name.replace(/^v/, "");
});

const getLatestVersionWithFallback = () =>
  getLatestVersion().pipe(
    Effect.catch(
      Effect.fn("getLatestVersionErrorHandler")(function* (error: HttpError) {
        yield* logApiFailure("Failed to fetch version from GitHub API", error.status, error);
        return yield* Effect.succeed("0.0.0");
      }),
    ),
  );

export const githubIntegration = new Elysia({ name: "github" }).get(
  "/version",
  () =>
    runEffect(
      Effect.gen(function* () {
        yield* Effect.logInfo("Version endpoint called");

        const [version, commitHash] = yield* Effect.all([
          getLatestVersionWithFallback(),
          getLatestCommitHashWithFallback(),
        ]);

        const shortHash = commitHash.substring(0, 7);
        const versionString = `${version}-${shortHash}`;

        return new Response(versionString, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=300",
          },
        });
      }),
    ),
  {
    detail: {
      description: "Latest release version and commit hash as plain text",
      tags: ["system"],
    },
  },
);

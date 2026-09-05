import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { Headers, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { HttpError } from "@tom/types/errors";
import { logApiFailure, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { liveHttpClient } from "../../http-client";

const GITHUB_HEADERS = Headers.fromInput({
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "wwwtom-version-endpoint",
});

const GithubCommitSchema = Schema.Struct({ sha: Schema.optional(Schema.String) });

const GithubTagSchema = Schema.Struct({ name: Schema.optional(Schema.String) });

const fetchGithubJson = <A, I>(
  schema: Schema.Codec<A, I, never>,
  url: string,
): Effect.Effect<A, HttpError> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get(url, { headers: GITHUB_HEADERS }).pipe(
      Effect.mapError(
        (error) =>
          new HttpError({
            message: error instanceof Error ? error.message : "Failed to fetch from GitHub",
            status: 0,
          }),
      ),
    );

    const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.mapError(
        (error) =>
          new HttpError({
            message: `GitHub API error: ${error.response?.status ?? "unknown status"}`,
            status: error.response?.status ?? 0,
          }),
      ),
    );

    return yield* HttpClientResponse.schemaBodyJson(schema)(okResponse).pipe(
      Effect.mapError(
        (error) =>
          new HttpError({
            message: error instanceof Error ? error.message : "Failed to parse GitHub response",
            status: 0,
          }),
      ),
    );
  }).pipe(Effect.provide(liveHttpClient()));

const getLatestCommitHash = Effect.fn("getLatestCommitHash")(function* () {
  const data = yield* fetchGithubJson(
    GithubCommitSchema,
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
  const data = yield* fetchGithubJson(
    Schema.Array(GithubTagSchema),
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
  ({ request }) =>
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
      logContextFromRequest(request, "tom-adapter"),
    ),
  {
    detail: {
      description: "Latest release version and commit hash as plain text",
      tags: ["system"],
    },
  },
);

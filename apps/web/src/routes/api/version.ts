import type { APIEvent } from "@solidjs/start/server";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { runSimpleEffect } from "~/libs/runtime";

export async function GET(_event: APIEvent) {
  const program = Effect.gen(function* () {
    yield* Effect.logInfo("Version endpoint called");

    const [version, commitHash] = yield* Effect.all([getLatestVersion(), getLatestCommitHash()]);

    const shortHash = commitHash.substring(0, 7);
    const versionString = `${version}-${shortHash}`;

    yield* Effect.logDebug("Generated version string", { versionString });

    return new Response(versionString, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=300",
      },
    });
  });

  const action = program.pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Version endpoint error", error);
        return new Response("unknown", {
          status: HttpStatus.InternalServerError,
          headers: { "Content-Type": "text/plain" },
        });
      }),
    ),
  );
  const loggedAction = Effect.gen(function* () {
    yield* Effect.logInfo("version:get:start");
    return yield* action.pipe(
      Effect.tap(() => Effect.logDebug("version:get:success")),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError("version:get:error", error);
          return yield* Effect.fail(error);
        }),
      ),
    );
  });

  return runSimpleEffect(loggedAction);
}

function getLatestCommitHash(): Effect.Effect<string> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch("https://api.github.com/repos/et0and/wwwtom/commits/dev", {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "wwwtom-version-endpoint",
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        return (data.sha as string) ?? "unknown";
      },
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    return result;
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Failed to fetch commit from GitHub API", error);
        return yield* Effect.succeed("unknown");
      }),
    ),
  );
}

function getLatestVersion(): Effect.Effect<string> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch("https://api.github.com/repos/et0and/wwwtom/tags", {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "wwwtom-version-endpoint",
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        // Get the first tag (most recent)
        const latestTag = data[0];
        if (!latestTag || !latestTag.name) {
          return "0.0.0";
        }

        // Remove 'v' prefix if present
        return (latestTag.name as string).replace(/^v/, "");
      },
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    return result;
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Failed to fetch version from GitHub API", error);
        return yield* Effect.succeed("0.0.0");
      }),
    ),
  );
}

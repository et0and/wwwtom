import type { APIEvent } from "@solidjs/start/server";
import { logger, runServerEffect } from "~/libs/utils/logger";
import { ResultAsync, ok } from "neverthrow";

export async function GET(_event: APIEvent) {
	await runServerEffect(logger.info("Version endpoint called"));

	const result = await ResultAsync.combine([
		getLatestVersion(),
		getLatestCommitHash(),
	]);

	return result.match(
		([version, commitHash]) => {
			const shortHash = commitHash.substring(0, 7);
			const versionString = `${version}-${shortHash}`;

			runServerEffect(
				logger.debug("Generated version string", { versionString }),
			);

			return new Response(versionString, {
				headers: {
					"Content-Type": "text/plain",
					"Cache-Control": "public, max-age=300", // Cache for 5 minutes
				},
			});
		},
		(error) => {
			runServerEffect(logger.error("Version endpoint error", error));
			return new Response("unknown", {
				status: 500,
				headers: { "Content-Type": "text/plain" },
			});
		},
	);
}

function getLatestCommitHash(): ResultAsync<string, never> {
	return ResultAsync.fromPromise(
		(async () => {
			// Get the latest commit from the dev branch via GitHub API
			const response = await fetch(
				"https://api.github.com/repos/et0and/wwwtom/commits/dev",
				{
					headers: {
						Accept: "application/vnd.github.v3+json",
						"User-Agent": "wwwtom-version-endpoint",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const data = await response.json();
			return (data.sha as string) ?? "unknown";
		})(),
		(error) => (error instanceof Error ? error : new Error(String(error))),
	).orElse((error) => {
		runServerEffect(
			logger.error("Failed to fetch commit from GitHub API", error),
		);
		return ok("unknown");
	});
}

function getLatestVersion(): ResultAsync<string, never> {
	return ResultAsync.fromPromise(
		(async () => {
			// Get the latest tag from GitHub API
			const response = await fetch(
				"https://api.github.com/repos/et0and/wwwtom/tags",
				{
					headers: {
						Accept: "application/vnd.github.v3+json",
						"User-Agent": "wwwtom-version-endpoint",
					},
				},
			);

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
		})(),
		(error) => (error instanceof Error ? error : new Error(String(error))),
	).orElse((error) => {
		runServerEffect(
			logger.error("Failed to fetch version from GitHub API", error),
		);
		return ok("0.0.0");
	});
}

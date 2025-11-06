import type { APIEvent } from "@solidjs/start/server";

export async function GET({}: APIEvent) {
	try {
		// Get version from GitHub API tags
		const version = await getLatestVersion();

		// Get latest commit hash from GitHub API
		const commitHash = await getLatestCommitHash();

		// Format: version-commitHash (short hash)
		const shortHash = commitHash.substring(0, 7);
		const versionString = `${version}-${shortHash}`;

		return new Response(versionString, {
			headers: {
				"Content-Type": "text/plain",
				"Cache-Control": "public, max-age=300", // Cache for 5 minutes
			},
		});
	} catch (error) {
		console.error("Version endpoint error:", error);
		return new Response("unknown", {
			status: 500,
			headers: { "Content-Type": "text/plain" },
		});
	}
}

async function getLatestCommitHash(): Promise<string> {
	try {
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
		return data.sha ?? "unknown";
	} catch (error) {
		console.error("Failed to fetch commit from GitHub API:", error);
		return "unknown";
	}
}

async function getLatestVersion(): Promise<string> {
	try {
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
		return latestTag.name.replace(/^v/, "");
	} catch (error) {
		console.error("Failed to fetch version from GitHub API:", error);
		return "0.0.0";
	}
}

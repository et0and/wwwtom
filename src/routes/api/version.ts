import type { APIEvent } from "@solidjs/start/server";

export async function GET(_event: APIEvent) {
	try {
		console.log("Version endpoint called");
		
		// Get version from GitHub API tags
		const version = await getLatestVersion();
		console.log(`Version retrieved: ${version}`);

		// Get latest commit hash from GitHub API
		const commitHash = await getLatestCommitHash();
		console.log(`Commit hash retrieved: ${commitHash}`);

		// Format: version-commitHash (short hash)
		const shortHash = commitHash === "unknown" ? "unknown" : commitHash.substring(0, 7);
		const versionString = `${version}-${shortHash}`;
		console.log(`Final version string: ${versionString}`);

		return new Response(versionString, {
			headers: {
				"Content-Type": "text/plain",
				"Cache-Control": "public, max-age=300", // Cache for 5 minutes
			},
		});
	} catch (error) {
		console.error("Version endpoint error:", error);
		return new Response("debug-error", {
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
			console.error(`GitHub API commit error: ${response.status} ${response.statusText}`);
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const data = await response.json();
		const sha = data.sha;
		if (!sha) {
			console.error("No SHA found in GitHub API response");
			return "unknown";
		}
		return sha;
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
			console.error(`GitHub API tags error: ${response.status} ${response.statusText}`);
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const data = await response.json();
		// Get the first tag (most recent)
		const latestTag = data[0];
		if (!latestTag || !latestTag.name) {
			console.error("No tags found in GitHub API response");
			return "0.0.0";
		}

		// Remove 'v' prefix if present
		const version = latestTag.name.replace(/^v/, "");
		console.log(`Found version: ${version}`);
		return version;
	} catch (error) {
		console.error("Failed to fetch version from GitHub API:", error);
		return "0.0.0";
	}
}

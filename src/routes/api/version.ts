import type { APIEvent } from "@solidjs/start/server";

export async function GET({ _request }: APIEvent) {
	try {
		// Get version from package.json
		const version = getVersion();

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
		return data.sha || "unknown";
	} catch (error) {
		console.error("Failed to fetch commit from GitHub API:", error);
		return "unknown";
	}
}

function getVersion(): string {
	try {
		// Read package.json using Bun.file API
		const packageJsonText = Bun.file(
			`${import.meta.dir}/../../../../package.json`,
		).text();
		const packageJson = JSON.parse(packageJsonText);
		return packageJson.version || "0.0.0";
	} catch {
		// Fallback version
		return "0.0.0";
	}
}

import type { APIEvent } from "@solidjs/start/server";

export async function GET({ _request }: APIEvent) {
	try {
		// Get current commit hash
		const commitHash = await getCurrentCommitHash();
		
		// Get version from package.json or environment
		const version = getVersion();
		
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

async function getCurrentCommitHash(): Promise<string> {
	try {
		// Try to get commit hash from git
		const { execSync } = await import("child_process");
		const hash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
		return hash;
	} catch {
		// Fallback for production environments where git might not be available
		return "unknown";
	}
}

function getVersion(): string {
	try {
		// Try to get version from package.json
		const packageJson = require("../../../../package.json");
		return packageJson.version || "0.0.0";
	} catch {
		// Fallback version
		return "0.0.0";
	}
}
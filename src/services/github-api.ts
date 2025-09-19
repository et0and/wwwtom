interface GitHubRelease {
	tag_name: string;
	html_url: string;
}

interface GitHubCommit {
	sha: string;
	commit: {
		message: string;
	};
	html_url: string;
}

interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
}

interface CachedData<T> {
	data: T;
	timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
const REPO_OWNER = "et0and";
const REPO_NAME = "wwwtom";

let releasesCache: CachedData<GitHubRelease[]> | null = null;
let commitsCache: CachedData<GitHubCommit[]> | null = null;
let branchesCache: CachedData<GitHubBranch[]> | null = null;

const isExpired = (timestamp: number): boolean => {
	return Date.now() - timestamp > CACHE_DURATION;
};

export const getLatestRelease = async (): Promise<GitHubRelease | null> => {
	if (!releasesCache || isExpired(releasesCache.timestamp)) {
		try {
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
			);
			if (!response.ok) throw new Error("Failed to fetch releases");

			const releases: GitHubRelease[] = await response.json();
			releasesCache = {
				data: releases,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Error fetching GitHub releases:", error);
			return null;
		}
	}

	return releasesCache.data[0] || null;
};

export const getLatestCommit = async (): Promise<GitHubCommit | null> => {
	if (!commitsCache || isExpired(commitsCache.timestamp)) {
		try {
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits`,
			);
			if (!response.ok) throw new Error("Failed to fetch commits");

			const commits: GitHubCommit[] = await response.json();
			commitsCache = {
				data: commits,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Error fetching GitHub commits:", error);
			return null;
		}
	}

	return commitsCache.data[0] || null;
};

export const getBranches = async (): Promise<GitHubBranch[]> => {
	if (!branchesCache || isExpired(branchesCache.timestamp)) {
		try {
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches`,
			);
			if (!response.ok) throw new Error("Failed to fetch branches");

			const branches: GitHubBranch[] = await response.json();
			branchesCache = {
				data: branches,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Error fetching GitHub branches:", error);
			return [];
		}
	}

	return branchesCache.data;
};

const getCurrentBranch = async (currentSha: string): Promise<string> => {
	const branches = await getBranches();

	// Find branch that matches the current commit SHA
	const matchingBranch = branches.find(
		(branch) => branch.commit.sha === currentSha,
	);

	if (matchingBranch) {
		// Map branch names to deployment environments
		const branchName = matchingBranch.name.toLowerCase();
		if (branchName === "main" || branchName === "production") return "prod";
		if (branchName === "staging") return "staging";
		return "dev";
	}

	return "dev"; // fallback
};

export const getDeploymentInfo = async () => {
	const [latestRelease, latestCommit] = await Promise.all([
		getLatestRelease(),
		getLatestCommit(),
	]);

	if (!latestCommit) {
		return {
			branch: "dev",
			hash: "local",
			version: "dev",
		};
	}

	const branch = await getCurrentBranch(latestCommit.sha);

	// For production, don't show version info
	if (branch === "prod") {
		return {
			branch: "prod",
			hash: "",
			version: "",
		};
	}

	return {
		branch,
		hash: latestCommit.sha.substring(0, 7),
		version: latestRelease?.tag_name ?? "dev",
	};
};

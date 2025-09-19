// For development/staging, we can use environment variables or GitHub API
// For production, we don't show version info
const getDeploymentInfo = () => {
	// Use environment variables if available (set by CI/CD)
	const envBranch = process.env.GIT_BRANCH;
	const envCommit = process.env.GIT_COMMIT;
	const envVersion = process.env.GIT_TAG;

	// Fallback values for local development
	return {
		branch: envBranch ?? "dev",
		hash: envCommit?.substring(0, 7) ?? "local",
		version: envVersion ?? "dev",
	};
};

const { branch, hash, version } = getDeploymentInfo();

// determine background and text colors based on branch
const branchClass =
	branch === "dev"
		? "bg-[#3b2724]"
		: branch === "staging"
			? "bg-[#42320d]"
			: branch === "prod"
				? "bg-[#0d4a0b]"
				: "";

export default function Footer() {
	const currentYear = new Date().getFullYear();
	return (
		<footer class="flex flex-col sm:flex-row items-center justify-between px-6 py-4 text-sm flex-shrink-0">
			<p>
				&copy; {currentYear} <a href="/accessibility">Accessibility</a>. This
				site is part of a{" "}
				<a href="https://webring.xxiivv.com/#random">webring</a>.{" "}
			</p>
			{branch !== "prod" && (
				<p class="my-1">
					<span
						class={`${branchClass} sm:p-1 inline-block w-3 h-3 rounded-full sm:hidden`}
					/>{" "}
					<span class="text-xs sm:hidden">Running on {version}</span>
					<span
						class={`${branchClass} p-1 text-white font-medium hidden sm:inline`}
					>
						{branch.toUpperCase()}
					</span>{" "}
					<a
						class="hidden sm:inline"
						href={`https://github.com/et0and/wwwtom/releases/tag/${version}`}
					>
						{version} ({hash})
					</a>
				</p>
			)}
		</footer>
	);
}

import childProcess from "node:child_process";

// obtain GitHub release version and branch
const version = childProcess
	.execSync("git describe --tags --abbrev=0")
	.toString()
	.trim();

const hash = childProcess
	.execSync("git rev-parse --short HEAD")
	.toString()
	.trim();

const branch = childProcess
	.execSync("git rev-parse --abbrev-ref HEAD")
	.toString()
	.trim();

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

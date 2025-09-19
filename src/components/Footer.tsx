import { createResource } from "solid-js";
import { getDeploymentInfo } from "~/services/github-api";

export default function Footer() {
	const [deploymentInfo] = createResource(getDeploymentInfo);

	const branch = () => deploymentInfo()?.branch ?? "dev";
	const hash = () => deploymentInfo()?.hash ?? "local";
	const version = () => deploymentInfo()?.version ?? "dev";

	const branchClass = () => {
		const b = branch();
		return b === "dev"
			? "bg-[#3b2724]"
			: b === "staging"
				? "bg-[#42320d]"
				: b === "prod"
					? "bg-[#0d4a0b]"
					: "";
	};

	const currentYear = new Date().getFullYear();
	return (
		<footer class="flex flex-col sm:flex-row items-center justify-between px-6 py-4 text-sm flex-shrink-0">
			<p>
				&copy; {currentYear} <a href="/accessibility">Accessibility</a>. This
				site is part of a{" "}
				<a href="https://webring.xxiivv.com/#random">webring</a>.{" "}
			</p>
			{branch() !== "prod" && (
				<p class="my-1">
					<span
						class={`${branchClass()} sm:p-1 inline-block w-3 h-3 rounded-full sm:hidden`}
					/>{" "}
					<span class="text-xs sm:hidden">Running on {version()}</span>
					<span
						class={`${branchClass()} p-1 text-white font-medium hidden sm:inline`}
					>
						{branch().toUpperCase()}
					</span>{" "}
					<a
						class="hidden sm:inline"
						href={`https://github.com/et0and/wwwtom/releases/tag/${version()}`}
					>
						{version()} ({hash()})
					</a>
				</p>
			)}
		</footer>
	);
}

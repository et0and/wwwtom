import { createResource, Show } from "solid-js";

async function getVersion() {
	try {
		const response = await fetch("/api/version");
		if (!response.ok) {
			return null;
		}
		return await response.text();
	} catch (error) {
		console.error("Failed to fetch version:", error);
		return null;
	}
}

export function Footer() {
	const currentYear = new Date().getFullYear();
	const [version] = createResource(getVersion);
	
	return (
		<footer class="flex flex-col sm:flex-row items-center justify-between px-6 py-4 text-sm flex-shrink-0">
			<p>
				&copy; {currentYear} <a href="/accessibility">Accessibility</a>. This
				site is part of a{" "}
				<a href="https://webring.xxiivv.com/#random">webring</a>.{" "}
				<Show when={version()}>
					<span class="text-xs opacity-75">({version()})</span>
				</Show>
			</p>
		</footer>
	);
}

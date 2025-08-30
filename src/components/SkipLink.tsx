export function SkipLink() {
	return (
		<a
			href="#main"
			class="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-1/2 focus:transform focus:-translate-x-1/2 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:underline focus:outline-none"
		>
			Skip to main content
		</a>
	);
}

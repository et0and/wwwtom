// Auto-generated types for work routes
// This ensures your page links are type-safe against actual files

export type WorkRoute =
	| "/work/an-idea-for-a-performance"
	| "/work/aotearoa-artist-ephemera"
	| "/work/hyperjam"
	| "/work/museum-without-walls";

export interface WorkPage {
	href: WorkRoute;
	text: string;
}

// Helper function to convert route to title
const routeToTitle = (route: WorkRoute): string => {
	return route
		.replace("/work/", "")
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

// Export the pages array
export const workPages: WorkPage[] = (
	[
		"/work/an-idea-for-a-performance",
		"/work/aotearoa-artist-ephemera",
		"/work/hyperjam",
		"/work/museum-without-walls",
	] as WorkRoute[]
).map((route) => ({
	href: route,
	text: routeToTitle(route),
}));

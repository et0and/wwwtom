// Auto-generated types for work routes
// This ensures your page links are type-safe against actual files

export type WorkRoute =
	| "/work/an-idea-for-a-performance"
	| "/work/aotearoa-artist-ephemera"
	| "/work/hyperjam"
	| "/work/museum-without-walls"
	| "/work/artists-from-asia"
	| "/work/church-yard"
	| "/work/derridata"
	| "/work/good-sign-offs"
	| "/work/headings-checker"
	| "/work/imaginary-museum"
	| "/work/markono"
	| "/work/performa"
	| "/work/philemon"
	| "/work/poetics-of-space"
	| "/work/sikemap"
	| "/work/some-quiet-tips"
	| "/work/te-wahi-auaha"
	| "/work/this-building-does-not-exist"
	| "/work/txtne-ws"
	| "/work/txtrnz"
	| "/work/whitecubes"
	| "/work/work"
	| "/work/www";

export interface WorkPage {
	href: WorkRoute;
	title: string;
	summary: string;
	publishedAt: string;
}

// Export the work pages array with extracted frontmatter data
export const workPages: WorkPage[] = (
	[
		{
			href: "/work/an-idea-for-a-performance",
			title: "An idea for a performance",
			summary: "A tool for generating performance ideas",
			publishedAt: "2020-04-05",
		},
		{
			href: "/work/aotearoa-artist-ephemera",
			title: "Aotearoa artist ephemera",
			summary: "An archive of artist and gallery materials",
			publishedAt: "2019-04-05",
		},
		{
			href: "/work/hyperjam",
			title: "Hyperjam",
			summary: "A Merveilles online game festival.",
			publishedAt: "2020-04-07",
		},
		{
			href: "/work/museum-without-walls",
			title: "The museum without walls",
			summary: "A game made for Macintosh Plus",
			publishedAt: "2020-04-03",
		},
		{
			href: "/work/artists-from-asia",
			title: "Artists from Asia",
			summary: "An artist database",
			publishedAt: "2019-08-05",
		},
		{
			href: "/work/church-yard",
			title: "Church yard",
			summary: "Private research archive on Søren Kierkegaard",
			publishedAt: "2020-04-20",
		},
		{
			href: "/work/derridata",
			title: "Derridata",
			summary: "Research archive on Jacques Derrida",
			publishedAt: "2020-04-20",
		},
		{
			href: "/work/good-sign-offs",
			title: "Good sign-offs",
			summary: "A collection of sign-offs, displaying using the are.na API",
			publishedAt: "2024-04-05",
		},
		{
			href: "/work/headings-checker",
			title: "Headings checker",
			summary: "A tool for detecting improper heading order in React",
			publishedAt: "2024-12-13",
		},
		{
			href: "/work/imaginary-museum",
			title: "Imaginary museum",
			summary: "A reference of images",
			publishedAt: "2020-04-20",
		},
		{
			href: "/work/markono",
			title: "Markono",
			summary: "A program for generating chance performances",
			publishedAt: "2020-01-21",
		},
		{
			href: "/work/performa",
			title: "Performa",
			summary: "A performance art archive",
			publishedAt: "2019-01-07",
		},
		{
			href: "/work/philemon",
			title: "Philemon",
			summary: "A Jungian archive",
			publishedAt: "2019-01-07",
		},
		{
			href: "/work/poetics-of-space",
			title: "Poetics of Space",
			summary: "An archive of architectural images and spaces",
			publishedAt: "2020-01-07",
		},
		{
			href: "/work/sikemap",
			title: "Sikemap",
			summary:
				"A simple CLI tool for generating sitemaps and archives of websites",
			publishedAt: "2025-04-04",
		},
		{
			href: "/work/some-quiet-tips",
			title: "Some quiet tips",
			summary: 'A "chat" experiment',
			publishedAt: "2020-01-07",
		},
		{
			href: "/work/te-wahi-auaha",
			title: "Te Wāhi Auaha",
			summary: "A maker space",
			publishedAt: "2022-06-02",
		},
		{
			href: "/work/this-building-does-not-exist",
			title: "This building does not exist",
			summary: "An early GAN experiment",
			publishedAt: "2020-04-07",
		},
		{
			href: "/work/txtne-ws",
			title: "txtne.ws",
			summary: "A text-focused news aggregator",
			publishedAt: "2025-05-25",
		},
		{
			href: "/work/txtrnz",
			title: "TXTRNZ",
			summary: "A text-only news service",
			publishedAt: "2022-05-30",
		},
		{
			href: "/work/whitecubes",
			title: "Whitecubes",
			summary: "A map of all public art galleries in Tāmaki Makaurau",
			publishedAt: "2019-04-21",
		},
		{
			href: "/work/work",
			title: "Work",
			summary: "A series of works made for the web",
			publishedAt: "2024-09-21",
		},
		{
			href: "/work/www",
			title: "WWW",
			summary: "A mass archive of weird, wonderful websites",
			publishedAt: "2020-04-20",
		},
	] as WorkPage[]
).sort(
	(a, b) =>
		new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);

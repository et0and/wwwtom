import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface Frontmatter {
	title: string;
	summary: string;
	publishedAt: string;
}

function extractFrontmatter(content: string): Frontmatter | null {
	const frontmatterMatch = content.match(
		/export const frontmatter = \{([^}]+)\}/s,
	);
	if (!frontmatterMatch) return null;

	const frontmatterContent = frontmatterMatch[1];

	// Extract title (handle escaped quotes)
	const titleMatch = frontmatterContent.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
	const title = titleMatch ? titleMatch[1].replace(/\\"/g, '"') : "";

	// Extract summary (handle escaped quotes)
	const summaryMatch = frontmatterContent.match(
		/summary:\s*"((?:[^"\\]|\\.)*)"/,
	);
	const summary = summaryMatch ? summaryMatch[1].replace(/\\"/g, '"') : "";

	// Extract publishedAt
	const publishedAtMatch = frontmatterContent.match(/publishedAt:\s*"([^"]+)"/);
	const publishedAt = publishedAtMatch ? publishedAtMatch[1] : "";

	return { title, summary, publishedAt };
}

function generatePostRoutes() {
	const postsDir = join(process.cwd(), "src/routes/posts");
	const files = readdirSync(postsDir).filter(
		(file) => file.endsWith(".mdx") && file !== "index.mdx",
	);

	const routes = files.map((file) => `/posts/${file.replace(".mdx", "")}`);
	const posts = files
		.map((file) => {
			const filePath = join(postsDir, file);
			const content = readFileSync(filePath, "utf-8");
			const frontmatter = extractFrontmatter(content);

			if (!frontmatter) {
				console.warn(`Warning: Could not extract frontmatter from ${file}`);
				return null;
			}

			return {
				href: `/posts/${file.replace(".mdx", "")}`,
				...frontmatter,
			};
		})
		.filter(Boolean);

	const routeType = routes.map((route) => `\t| "${route}"`).join("\n");

	const postData = posts
		.map(
			(post) => `\t{
\t\thref: "${post!.href}",
\t\ttitle: "${post!.title.replace(/"/g, '\\"')}",
\t\tsummary: "${post!.summary.replace(/"/g, '\\"')}",
\t\tpublishedAt: "${post!.publishedAt}",
\t}`,
		)
		.join(",\n");

	const output = `// Auto-generated types for post routes
// This ensures your page links are type-safe against actual files

export type PostRoute =
${routeType};

export interface PostPage {
	href: PostRoute;
	title: string;
	summary: string;
	publishedAt: string;
}

// Export the posts array with extracted frontmatter data
export const postPages: PostPage[] = ([
${postData},
] as PostPage[]).sort(
	(a, b) =>
		new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);
`;

	const outputPath = join(process.cwd(), "src/types/post-routes.ts");
	writeFileSync(outputPath, output);
	console.log("✓ Generated post route types!");
}

function generateWorkRoutes() {
	const workDir = join(process.cwd(), "src/routes/work");
	const files = readdirSync(workDir).filter(
		(file) => file.endsWith(".mdx") && file !== "index.mdx",
	);

	const routes = files.map((file) => `/work/${file.replace(".mdx", "")}`);

	const posts = files
		.map((file) => {
			const filePath = join(workDir, file);
			const content = readFileSync(filePath, "utf-8");
			const frontmatter = extractFrontmatter(content);

			if (!frontmatter) {
				console.warn(`Warning: Could not extract frontmatter from ${file}`);
				return null;
			}

			return {
				href: `/work/${file.replace(".mdx", "")}`,
				...frontmatter,
			};
		})
		.filter(Boolean);

	const routeType = routes.map((route) => `\t| "${route}"`).join("\n");

	const workData = posts
		.map(
			(post) => `\t{
\t\thref: "${post!.href}",
\t\ttitle: "${post!.title.replace(/"/g, '\\"')}",
\t\tsummary: "${post!.summary.replace(/"/g, '\\"')}",
\t\tpublishedAt: "${post!.publishedAt}",
\t}`,
		)
		.join(",\n");

	const output = `// Auto-generated types for work routes
// This ensures your page links are type-safe against actual files

export type WorkRoute =
${routeType};

export interface WorkPage {
	href: WorkRoute;
	title: string;
	summary: string;
	publishedAt: string;
}

// Export the work pages array with extracted frontmatter data
export const workPages: WorkPage[] = ([
${workData},
] as WorkPage[]).sort(
	(a, b) =>
		new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);
`;

	const outputPath = join(process.cwd(), "src/types/work-routes.ts");
	writeFileSync(outputPath, output);
	console.log("✓ Generated work route types!");
}

generatePostRoutes();
generateWorkRoutes();

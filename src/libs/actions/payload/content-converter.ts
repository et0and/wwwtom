import type { PayloadContentNode, PayloadMedia } from "../../schemas/payload";
import type { ArenaBlockData } from "../../schemas/arena";

function extractTextFromLexical(node: PayloadContentNode): string {
	if (!node) return "";

	if (node.type === "root" && node.children) {
		return node.children.map(extractTextFromLexical).join("");
	}

	if (node.type === "paragraph" && node.children) {
		return node.children.map(extractTextFromLexical).join("");
	}

	if (node.type === "heading" && node.children) {
		return node.children.map(extractTextFromLexical).join("");
	}

	if (node.type === "text") {
		return node.text || "";
	}

	return "";
}

export function extractArenaBlocks(node: PayloadContentNode): ArenaBlockData[] {
	const blocks: ArenaBlockData[] = [];

	function traverse(n: PayloadContentNode) {
		if (!n) return;

		if (n.type === "block" && n.fields?.blockType === "arena") {
			const slug = n.fields.arenaSlug || "";
			const title = n.fields.arenaTitle || "";
			blocks.push({ slug, title });
		}

		if (n.children) {
			n.children.forEach(traverse);
		}
	}

	traverse(node);
	return blocks;
}

export function convertLexicalToHTML(
	node: PayloadContentNode,
	skipArena = false,
): string {
	if (!node) return "";

	if (node.type === "root" && node.children) {
		return node.children
			.map((child) => convertLexicalToHTML(child, skipArena))
			.join("");
	}

	if (node.type === "paragraph" && node.children) {
		const text = node.children
			.map((child: PayloadContentNode) => {
				if (child.type === "text") {
					return formatText(child);
				} else if (child.type === "link" && child.fields && child.children) {
					return convertLink(child);
				}
				return convertLexicalToHTML(child, skipArena);
			})
			.join("");
		return `<p>${text}</p>`;
	}

	if (node.type === "heading" && node.children) {
		const text = node.children
			.map((child: PayloadContentNode) => {
				if (child.type === "text") {
					return formatText(child);
				}
				return convertLexicalToHTML(child, skipArena);
			})
			.join("");
		const level = node.tag || "h2";
		return `<${level}>${text}</${level}>`;
	}

	if (node.type === "block" && node.fields) {
		return convertBlock(node, skipArena);
	}

	if (node.type === "text") {
		return formatText(node);
	}

	return "";
}

function formatText(node: PayloadContentNode): string {
	let text = node.text || "";
	if ((node.format || 0) & 1) text = `<strong>${text}</strong>`;
	if ((node.format || 0) & 2) text = `<em>${text}</em>`;
	return text;
}

function convertLink(node: PayloadContentNode): string {
	if (!node.fields || !node.children) return "";

	const linkText = node.children
		.map((c: PayloadContentNode) => c.text || "")
		.join("");
	const url = node.fields.url || "#";
	const newTab = node.fields.newTab ? ' target="_blank" rel="noopener"' : "";
	return `<a href="${url}"${newTab}>${linkText}</a>`;
}

function convertBlock(node: PayloadContentNode, skipArena = false): string {
	if (!node.fields) return "";

	if (node.fields.blockType === "banner" && node.fields.content) {
		const bannerContent = convertLexicalToHTML(
			node.fields.content.root,
			skipArena,
		);
		return `<div role="region" class="banner"><p class="banner-title">Note</p>${bannerContent}</div>`;
	}

	if (node.fields.blockType === "arena" && node.fields.content) {
		if (skipArena) return "";
		const arenaSlug = extractTextFromLexical(node.fields.content.root);
		const arenaTitle = extractTextFromLexical(node.fields.content.root);
		return `<ArenaCarousel slug="${arenaSlug}" title="${arenaTitle}" />`;
	}

	if (node.fields.blockType === "mediaBlock" && node.fields.media) {
		return convertMediaBlock(node.fields.media);
	}

	return "";
}

function convertMediaBlock(media: PayloadMedia): string {
	const caption = media.caption ? convertLexicalToHTML(media.caption.root) : "";
	return `<figure class="media-block">
		<img src="${media.url}" alt="${media.alt || ""}" />
		${caption ? `<figcaption>${caption}</figcaption>` : ""}
	</figure>`;
}

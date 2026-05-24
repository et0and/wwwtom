import type {
  PayloadContentNode,
  PayloadMedia,
  PayloadMediaSize,
  ArenaBlockData,
} from "@tom/payload";

import { highlightCodeBlock } from "./highlight";

const CDN_DOMAIN = "cdn.tom.so";

function getOptimizedImageUrl(url: string, _width: number, format = "webp"): string {
  if (!url.includes(CDN_DOMAIN)) return url;
  return `/api/image?url=${encodeURIComponent(url)}&format=${format}`;
}

function buildSrcSet(media: PayloadMedia): string {
  const sources: Array<{ url: string; width: number }> = [];

  const sizeKeys: Array<keyof typeof media.sizes> = [
    "thumbnail",
    "small",
    "medium",
    "large",
    "xlarge",
  ];

  for (const key of sizeKeys) {
    const size = media.sizes[key] as PayloadMediaSize | null;
    if (size?.url && size.width) {
      sources.push({ url: size.url, width: size.width });
    }
  }

  if (sources.length === 0 && media.url) {
    sources.push({ url: media.url, width: media.width || 800 });
  }

  return sources.map((s) => `${getOptimizedImageUrl(s.url, s.width)} ${s.width}w`).join(", ");
}

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

export async function convertLexicalToHTML(
  node: PayloadContentNode,
  skipArena = false,
): Promise<string> {
  if (!node) return "";

  if (node.type === "root" && node.children) {
    const children = await Promise.all(
      node.children.map((child) => convertLexicalToHTML(child, skipArena)),
    );
    return children.join("");
  }

  if (node.type === "paragraph" && node.children) {
    const text = await Promise.all(
      node.children.map(async (child: PayloadContentNode) => {
        if (child.type === "text") {
          return formatText(child);
        } else if (child.type === "link" && child.fields && child.children) {
          return convertLink(child);
        }
        return convertLexicalToHTML(child, skipArena);
      }),
    );
    return `<p>${text.join("")}</p>`;
  }

  if (node.type === "heading" && node.children) {
    const text = await Promise.all(
      node.children.map(async (child: PayloadContentNode) => {
        if (child.type === "text") {
          return formatText(child);
        }
        return convertLexicalToHTML(child, skipArena);
      }),
    );
    const level = node.tag || "h2";
    return `<${level}>${text.join("")}</${level}>`;
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
  const format = typeof node.format === "number" ? node.format : 0;
  if (format & 1) text = `<strong>${text}</strong>`;
  if (format & 2) text = `<em>${text}</em>`;
  return text;
}

function convertLink(node: PayloadContentNode): string {
  if (!node.fields || !node.children) return "";

  const linkText = node.children.map((c: PayloadContentNode) => c.text || "").join("");
  const url = node.fields.url || "#";
  const newTab = node.fields.newTab ? ' target="_blank" rel="noopener"' : "";
  return `<a href="${url}"${newTab}>${linkText}</a>`;
}

async function convertBlock(node: PayloadContentNode, skipArena = false): Promise<string> {
  if (!node.fields) return "";

  if (node.fields.blockType === "banner" && node.fields.content) {
    const bannerContent = await convertLexicalToHTML(node.fields.content.root, skipArena);
    return `<div role="region" class="banner"><p class="banner-title">Note</p>${bannerContent}</div>`;
  }

  if (node.fields.blockType === "arena" && node.fields.content) {
    if (skipArena) return "";
    const arenaSlug = extractTextFromLexical(node.fields.content.root);
    const arenaTitle = extractTextFromLexical(node.fields.content.root);
    return `<ArenaCarousel slug="${arenaSlug}" title="${arenaTitle}" />`;
  }

  if (node.fields.blockType === "mediaBlock" && node.fields.media) {
    return await convertMediaBlock(node.fields.media);
  }

  if (node.fields.blockType === "code" && node.fields.code) {
    return highlightCodeBlock(
      node.fields.code,
      node.fields.language || "text",
      node.fields.fileName,
      node.fields.showLineNumbers,
    );
  }

  return "";
}

async function convertMediaBlock(media: PayloadMedia): Promise<string> {
  const caption = media.caption ? await convertLexicalToHTML(media.caption.root) : "";
  const srcset = buildSrcSet(media);
  const defaultSrc = getOptimizedImageUrl(media.url, 900);

  return `<figure class="media-block">
		<img
			src="${defaultSrc}"
			srcset="${srcset}"
			sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 900px"
			alt="${media.alt || ""}"
			width="${media.width}"
			height="${media.height}"
			loading="lazy"
			decoding="async"
		/>
		${caption ? `<figcaption>${caption}</figcaption>` : ""}
	</figure>`;
}

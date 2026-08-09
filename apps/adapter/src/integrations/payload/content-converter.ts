import { Effect } from "effect";
import type { ArenaBlockData } from "@tom/schemas/arena";
import type { PayloadContentNode, PayloadMedia, PayloadMediaSize } from "@tom/schemas/payload";

import { highlightCodeBlock } from "./highlight";

const CDN_DOMAIN = "cdn.tom.so";

const getOptimizedImageUrl = (
  adapterUrl: string,
  url: string,
  _width: number,
  format = "webp",
): string => {
  if (!url.includes(CDN_DOMAIN)) return url;
  return `${adapterUrl}/image?url=${encodeURIComponent(url)}&format=${format}`;
};

const buildSrcSet = (adapterUrl: string, media: PayloadMedia): string => {
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

  return sources
    .map((s) => `${getOptimizedImageUrl(adapterUrl, s.url, s.width)} ${s.width}w`)
    .join(", ");
};

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

export const convertLexicalToHTML = (
  node: PayloadContentNode,
  adapterUrl: string,
  skipArena = false,
): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    if (!node) return "";

    if (node.type === "root" && node.children) {
      const children = yield* Effect.all(
        node.children.map((child) => convertLexicalToHTML(child, adapterUrl, skipArena)),
      );
      return children.join("");
    }

    if (node.type === "paragraph" && node.children) {
      const text = yield* Effect.all(
        node.children.map((child: PayloadContentNode) => {
          if (child.type === "text") {
            return Effect.succeed(formatText(child));
          }
          if (child.type === "link" && child.fields && child.children) {
            return Effect.succeed(convertLink(child));
          }
          return convertLexicalToHTML(child, adapterUrl, skipArena);
        }),
      );
      return `<p>${text.join("")}</p>`;
    }

    if (node.type === "heading" && node.children) {
      const text = yield* Effect.all(
        node.children.map((child: PayloadContentNode) => {
          if (child.type === "text") {
            return Effect.succeed(formatText(child));
          }
          return convertLexicalToHTML(child, adapterUrl, skipArena);
        }),
      );
      const level = node.tag || "h2";
      return `<${level}>${text.join("")}</${level}>`;
    }

    if (node.type === "block" && node.fields) {
      return yield* convertBlock(node, adapterUrl, skipArena);
    }

    if (node.type === "text") {
      return formatText(node);
    }

    return "";
  });

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

const convertBlock = (
  node: PayloadContentNode,
  adapterUrl: string,
  skipArena = false,
): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    if (!node.fields) return "";

    if (node.fields.blockType === "banner" && node.fields.content) {
      const bannerContent = yield* convertLexicalToHTML(
        node.fields.content.root,
        adapterUrl,
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
      return yield* convertMediaBlock(adapterUrl, node.fields.media);
    }

    if (node.fields.blockType === "code" && node.fields.code) {
      return yield* highlightCodeBlock(
        node.fields.code,
        node.fields.language || "text",
        node.fields.fileName,
        node.fields.showLineNumbers,
      );
    }

    return "";
  });

const convertMediaBlock = (
  adapterUrl: string,
  media: PayloadMedia,
): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    const caption = media.caption
      ? yield* convertLexicalToHTML(media.caption.root, adapterUrl)
      : "";
    const srcset = buildSrcSet(adapterUrl, media);
    const defaultSrc = getOptimizedImageUrl(adapterUrl, media.url, 900);

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
  });

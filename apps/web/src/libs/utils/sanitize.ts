/**
 * Allow-list HTML sanitizer for third-party markup (Are.na blocks, oEmbed).
 * Browser-only (uses DOMParser); never import into Worker code.
 */

const RICH_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
]);

const RICH_ATTRS = new Set(["href", "title"]);

const FRAME_TAGS = new Set(["iframe"]);

const FRAME_ATTRS = new Set(["allow", "allowfullscreen", "height", "src", "title", "width"]);

const LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const DROP_TAGS = new Set(["script", "style", "template", "noscript", "object", "embed"]);

/** Accept http/https/mailto links plus relative URLs; reject javascript:/data:. */
const hasSafeScheme = (value: string): boolean => {
  try {
    return LINK_SCHEMES.has(new URL(value, "https://sanitize.invalid").protocol);
  } catch {
    return false;
  }
};

const scrubAttributes = (element: Element, allowedAttrs: ReadonlySet<string>): void => {
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    if (!allowedAttrs.has(name)) {
      element.removeAttribute(attr.name);
      continue;
    }
    if ((name === "href" || name === "src") && !hasSafeScheme(attr.value))
      element.removeAttribute(attr.name);
  }
  if (element.tagName === "IFRAME") {
    const src = element.getAttribute("src") ?? "";
    if (!src.startsWith("https://")) element.removeAttribute("src");
    element.setAttribute("sandbox", "allow-scripts allow-same-origin");
  }
};

const sanitize = (
  dirty: string,
  allowedTags: ReadonlySet<string>,
  allowedAttrs: ReadonlySet<string>,
): string => {
  const doc = new DOMParser().parseFromString("<div></div>", "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  root.innerHTML = dirty;
  for (const element of root.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      if (DROP_TAGS.has(tag)) element.remove();
      else element.replaceWith(...element.childNodes);
      continue;
    }
    scrubAttributes(element, allowedAttrs);
  }
  return root.innerHTML;
};

/** Are.na text blocks: formatting and links only, no frames or scripts. */
export const sanitizeRichHtml = (dirty: string): string => sanitize(dirty, RICH_TAGS, RICH_ATTRS);

/** oEmbed markup: iframes with https sources only, sandboxed. */
export const sanitizeEmbedHtml = (dirty: string): string =>
  sanitize(dirty, FRAME_TAGS, FRAME_ATTRS);

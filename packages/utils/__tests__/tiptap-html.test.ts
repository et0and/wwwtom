import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { CmsMediaId, TiptapDoc } from "@tom/schemas/cms";
import { renderTiptapHtml } from "../src/tiptap-html";

const mediaUrl = (mediaId: string): string => `https://cdn.tom.so/content/media/${mediaId}/file`;

const doc = (type: TiptapDoc["content"][number]): TiptapDoc => ({ type: "doc", content: [type] });

const render = (document: TiptapDoc): Promise<string> =>
  Effect.runPromise(renderTiptapHtml(document, mediaUrl));

describe("renderTiptapHtml", () => {
  it("renders paragraphs with nested marks", async () => {
    const html = await render(
      doc({
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "world",
            marks: [{ type: "bold" }, { type: "italic" }],
          },
        ],
      }),
    );
    expect(html).toBe("<p>Hello <em><strong>world</strong></em></p>");
  });

  it("renders headings and rules", async () => {
    const html = await render({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
        { type: "horizontalRule" },
      ],
    });
    expect(html).toBe("<h2>Title</h2><hr>");
  });

  // Shiki engine init takes seconds on cold CI runners — allow a minute.
  it("highlights code blocks with filename and line numbers", { timeout: 60000 }, async () => {
    const html = await render({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts", fileName: "a.ts", showLineNumbers: true },
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    });
    expect(html).toContain(`<figure class="code-block" data-line-numbers="true">`);
    expect(html).toContain(`<figcaption class="code-filename">a.ts</figcaption>`);
    expect(html).toContain(`class="shiki-light"`);
    expect(html).toContain(`class="shiki-dark"`);
    expect(html).toContain(`<span class="line">`);
    expect(html).toContain("const");
  });

  it("renders plain code without spans for unknown languages", async () => {
    const html = await render({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "text" },
          content: [{ type: "text", text: "just words" }],
        },
      ],
    });
    expect(html).toContain(`<figure class="code-block">`);
    expect(html).toContain(`language-text`);
    expect(html).toContain("just words");
    expect(html).not.toContain(`<span class="line">`);
  });

  it("renders blockquotes", async () => {
    const html = await render(
      doc({
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Stay hungry." }] }],
      }),
    );
    expect(html).toBe("<blockquote><p>Stay hungry.</p></blockquote>");
  });

  it("renders nested banners", async () => {
    const html = await render(
      doc({
        type: "banner",
        attrs: { style: "warning" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Careful" }],
          },
          {
            type: "banner",
            attrs: { style: "info" },
            content: [],
          },
        ],
      }),
    );
    expect(html).toBe(
      `<div role="region" class="banner" data-banner="warning">` +
        `<p class="banner-title">Warning</p><p>Careful</p>` +
        `<div role="region" class="banner" data-banner="info">` +
        `<p class="banner-title">Note</p></div></div>`,
    );
  });

  it("renders arena refs and escapes titles", async () => {
    const arena = await render(
      doc({ type: "arena", attrs: { slug: "toms-place", title: "Tom's Place" } }),
    );
    expect(arena).toBe(`<div data-arena="toms-place" data-title="Tom&#39;s Place"></div>`);
  });

  it("renders media and escapes alt text", async () => {
    const media = await render(
      doc({ type: "cmsMedia", attrs: { mediaId: "media-1" as CmsMediaId, alt: "A <photo>" } }),
    );
    expect(media).toBe(
      `<figure><img src="https://cdn.tom.so/content/media/media-1/file" alt="A &lt;photo&gt;"></figure>`,
    );
  });

  it("escapes text and drops dangerous link targets", async () => {
    const html = await render(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `<script>alert("x")</script>`,
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
          {
            type: "text",
            text: "safe",
            marks: [{ type: "link", attrs: { href: "https://tom.so", target: "_blank" } }],
          },
        ],
      }),
    );
    expect(html).toBe(
      `<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;` +
        `<a href="https://tom.so" target="_blank" rel="noopener">safe</a></p>`,
    );
  });

  it("renders an empty document to an empty string", async () => {
    expect(await render({ type: "doc", content: [] })).toBe("");
  });

  it("drops non-allowlisted link targets", async () => {
    const html = await render(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "odd",
            marks: [{ type: "link", attrs: { href: "https://tom.so", target: "evil" } }],
          },
          {
            type: "text",
            text: "self",
            marks: [{ type: "link", attrs: { href: "https://tom.so", target: "_self" } }],
          },
        ],
      }),
    );
    expect(html).toBe(
      `<p><a href="https://tom.so">odd</a>` +
        `<a href="https://tom.so" target="_self">self</a></p>`,
    );
  });
});

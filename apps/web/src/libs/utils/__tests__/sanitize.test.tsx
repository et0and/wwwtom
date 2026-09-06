import { describe, expect, it } from "vitest";
import { sanitizeEmbedHtml, sanitizeRichHtml } from "../sanitize";

describe("sanitizeRichHtml", () => {
  it("keeps formatting and safe links", () => {
    const clean = sanitizeRichHtml(
      '<p>Hello <strong>world</strong> <a href="https://example.com" title="x">link</a></p>',
    );
    expect(clean).toContain("<strong>world</strong>");
    expect(clean).toContain('href="https://example.com"');
  });

  it("drops scripts and event handlers", () => {
    const clean = sanitizeRichHtml(
      '<p onclick="evil()">Hi<script>alert(1)</script><img src="x" onerror="evil()"></p>',
    );
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("Hi");
  });

  it("strips javascript: links but keeps text", () => {
    const clean = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>');
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("click");
  });

  it("unwraps iframes in rich text", () => {
    const clean = sanitizeRichHtml('<p>before</p><iframe src="https://example.com"></iframe>');
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain("before");
  });
});

describe("sanitizeEmbedHtml", () => {
  it("keeps https iframes and sandboxes them", () => {
    const clean = sanitizeEmbedHtml(
      '<iframe src="https://player.example.com/v/1" width="640" height="360"></iframe>',
    );
    expect(clean).toContain('src="https://player.example.com/v/1"');
    expect(clean).toContain('sandbox="allow-scripts allow-same-origin"');
  });

  it("drops non-https iframe sources", () => {
    const clean = sanitizeEmbedHtml('<iframe src="http://evil.example.com/x"></iframe>');
    expect(clean).not.toContain("src=");
  });

  it("drops scripts around embeds", () => {
    const clean = sanitizeEmbedHtml('<script>alert(1)</script><a href="https://example.com">x</a>');
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("<a");
    expect(clean).toContain("x");
  });
});

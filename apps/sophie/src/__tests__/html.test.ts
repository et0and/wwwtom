import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { TiptapDoc } from "@tom/schemas/cms";
import { renderTiptapHtml } from "@tom/utils/tiptap-html";

// Sophie renders post.html via innerHTML with no client-side sanitize pass.
// That is safe only because the API renders html at write time from a
// validated Tiptap doc; this pins the renderer's escaping from Sophie's
// side so a regression fails here, not in production markup.
const hostileDoc: TiptapDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: `<script>alert("x")</script>` }],
    },
  ],
};

describe("post html safety", () => {
  it("never passes <script> through the Tiptap renderer", async () => {
    const html = await Effect.runPromise(
      renderTiptapHtml(hostileDoc, () => "https://example.com/x"),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

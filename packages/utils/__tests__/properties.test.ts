import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import { FastCheck } from "effect/testing";
import { TomWorkMessage } from "@tom/schemas/queue";
import type { TiptapDoc } from "@tom/schemas/cms";
import { isSafeLinkHref, renderTiptapHtml } from "../src/tiptap-html";
import { toProblemResponse } from "../src/services/worker";

const mediaUrl = (mediaId: string): string => `https://cdn.tom.so/content/media/${mediaId}/file`;

/** Navigable targets, pinned as literals so the test defines the contract. */
const ALLOWED_PREFIXES: ReadonlyArray<string> = ["https://", "http://", "mailto:", "/", "#"];

describe("link safety properties", () => {
  it("allows only navigable targets for any href", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.string(), (href) => {
        const trimmed = href.trim();
        const expected = ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
        expect(isSafeLinkHref(href)).toBe(expected);
      }),
      { seed: 7, numRuns: 200 },
    );
  });

  it("drops unsafe link targets for any href", { timeout: 30_000 }, async () => {
    await FastCheck.assert(
      FastCheck.asyncProperty(FastCheck.string(), async (href) => {
        const document: TiptapDoc = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href } }] }],
            },
          ],
        };
        const html = await Effect.runPromise(renderTiptapHtml(document, mediaUrl));
        if (isSafeLinkHref(href)) {
          expect(html).toContain("<a href=");
        } else {
          expect(html).not.toContain("<a");
        }
        expect(html).not.toContain("javascript:");
      }),
      { seed: 11, numRuns: 50 },
    );
  });
});

describe("error status properties", () => {
  it(
    "keeps error statuses and falls back otherwise for any integer",
    { timeout: 30_000 },
    async () => {
      await FastCheck.assert(
        FastCheck.asyncProperty(FastCheck.integer(), async (status) => {
          const expected = status >= 400 && status < 600 ? status : 500;
          const response = toProblemResponse(status, "boom");
          expect(response.status).toBe(expected);
          expect(response.headers.get("content-type")).toBe("application/problem+json");
          const body = (await response.json()) as { status: number };
          expect(body.status).toBe(expected);
        }),
        { seed: 42, numRuns: 100 },
      );
    },
  );
});

describe("queue message properties", () => {
  it("round-trips any work message through encode and decode", { timeout: 30_000 }, () => {
    FastCheck.assert(
      FastCheck.property(Schema.toArbitrary(TomWorkMessage), (value) => {
        const encoded = Schema.encodeSync(TomWorkMessage)(value);
        const decoded = Schema.decodeUnknownSync(TomWorkMessage)(encoded);
        expect(decoded).toEqual(value);
      }),
      { seed: 99, numRuns: 25 },
    );
  });
});

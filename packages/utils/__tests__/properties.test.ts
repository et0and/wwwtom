import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import { Arbitrary } from "effect/unstable/arbitrary";
import { TomWorkMessage } from "@tom/schemas/queue";
import type { TiptapDoc } from "@tom/schemas/cms";
import { isSafeLinkHref, renderTiptapHtml } from "../src/tiptap-html";
import { toProblemResponse } from "../src/services/worker";

const mediaUrl = (mediaId: string): string => `https://cdn.tom.so/content/media/${mediaId}/file`;

/** Navigable targets, pinned as literals so the test defines the contract. */
const ALLOWED_PREFIXES: ReadonlyArray<string> = ["https://", "http://", "mailto:", "/", "#"];

/** Runs a property and fails with the shrunk counterexample when it falsifies. */
const checkProperty = <A>(
  arbitrary: Arbitrary.Arbitrary<A>,
  property: (value: A) => boolean | Promise<boolean>,
  options: Arbitrary.CheckOptions,
): Promise<void> =>
  Effect.runPromise(
    Arbitrary.checkEffect(
      arbitrary,
      (value) => Effect.promise(() => Promise.resolve(property(value))),
      options,
    ),
  ).then((result) => {
    expect(result._tag, Arbitrary.formatCheckFailure(result)).toBe("Passed");
  });

describe("link safety properties", () => {
  it("allows only navigable targets for any href", async () => {
    await checkProperty(
      Arbitrary.schema(Schema.String),
      (href) => {
        const trimmed = href.trim();
        const expected = ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
        return isSafeLinkHref(href) === expected;
      },
      { seed: 7, runs: 200 },
    );
  });

  it("drops unsafe link targets for any href", { timeout: 30_000 }, async () => {
    await checkProperty(
      Arbitrary.schema(Schema.String),
      async (href) => {
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
        if (html.includes("javascript:")) return false;
        if (isSafeLinkHref(href)) return html.includes("<a href=");
        return !html.includes("<a");
      },
      { seed: 11, runs: 50 },
    );
  });
});

describe("error status properties", () => {
  it(
    "keeps error statuses and falls back otherwise for any integer",
    { timeout: 30_000 },
    async () => {
      await checkProperty(
        Arbitrary.schema(Schema.Int),
        async (status) => {
          const expected = status >= 400 && status < 600 ? status : 500;
          const response = toProblemResponse(status, "boom");
          if (response.status !== expected) return false;
          if (response.headers.get("content-type") !== "application/problem+json") return false;
          const body = (await response.json()) as { status: number };
          return body.status === expected;
        },
        { seed: 42, runs: 100 },
      );
    },
  );
});

describe("queue message properties", () => {
  it("round-trips any work message through encode and decode", { timeout: 30_000 }, async () => {
    const equals = Schema.toEquivalence(TomWorkMessage);
    await checkProperty(
      Arbitrary.schema(TomWorkMessage),
      (value) => {
        const encoded = Schema.encodeSync(TomWorkMessage)(value);
        const decoded = Schema.decodeUnknownSync(TomWorkMessage)(encoded);
        return equals(decoded, value);
      },
      { seed: 99, runs: 25 },
    );
  });
});

import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import type { CmsD1Binding, CmsD1Statement } from "@tom/utils/services/config";
import { CmsSlug } from "@tom/schemas/cms";
import type { CmsPostInput, CmsWorkInput, TiptapDoc } from "@tom/schemas/cms";
import { createPost, createWork, updatePost, updateWork } from "../services/cms";

/**
 * The guard fires before any database touch, so the binding only needs to
 * satisfy the type — a write reaching it returns empty rows (and would
 * fail with 404, not 400).
 */
const inertStatement: CmsD1Statement = {
  bind: () => inertStatement,
  first: async () => null,
  all: async () => ({ results: [] }),
  run: async () => ({ success: true }),
};

const inertDb: CmsD1Binding = {
  prepare: () => inertStatement,
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({}),
};

const content: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

/** The shadowed slug, branded through the same schema production uses. */
const reservedSlug = Effect.runSync(Schema.decodeUnknownEffect(CmsSlug)("summary"));

const meta = { title: null, description: null, image: null };

const postInput = (slug: typeof reservedSlug): CmsPostInput => ({
  slug,
  title: "Title",
  summary: null,
  content,
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  categoryIds: [],
  meta,
});

const workInput = (slug: typeof reservedSlug): CmsWorkInput => ({
  slug,
  title: "Title",
  summary: null,
  content,
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  meta,
});

describe("reserved slugs", () => {
  it("rejects summary on post create", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(createPost(inertDb, postInput(reservedSlug), "actor", "http://localhost:8788")),
    );
    expect(failure.status).toBe(400);
  });

  it("rejects summary on post update", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        updatePost(
          inertDb,
          reservedSlug,
          postInput(reservedSlug),
          "actor",
          "http://localhost:8788",
        ),
      ),
    );
    expect(failure.status).toBe(400);
  });

  it("rejects summary on work create", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(createWork(inertDb, workInput(reservedSlug), "actor", "http://localhost:8788")),
    );
    expect(failure.status).toBe(400);
  });

  it("rejects summary on work update", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        updateWork(
          inertDb,
          reservedSlug,
          workInput(reservedSlug),
          "actor",
          "http://localhost:8788",
        ),
      ),
    );
    expect(failure.status).toBe(400);
  });
});

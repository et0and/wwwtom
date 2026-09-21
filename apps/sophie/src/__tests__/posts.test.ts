import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { ABOUT_SLUG, PAGES_CATEGORY, listPosts } from "../lib/posts";

describe("ABOUT_SLUG", () => {
  it("names the about slug", () => {
    expect(ABOUT_SLUG).toBe("about");
  });
});

describe("listPosts", () => {
  const fetchMock = vi.fn<typeof fetch>();

  const summaryList = {
    docs: [
      {
        id: "post-1",
        slug: "hello-world",
        title: "Hello World",
        summary: "A summary",
        status: "published",
        publishedAt: "2026-09-01T00:00:00.000Z",
        heroMediaId: null,
        categories: [{ id: "cat-1", slug: "essays", title: "Essays" }],
        meta: { title: null, description: null, image: null },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
    ],
    totalDocs: 1,
    limit: 10,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(summaryList), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const requestedUrl = (): string => {
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    return String(call?.[0] ?? "");
  };

  it("reads summaries and forwards a valid category slug", async () => {
    const result = await Effect.runPromise(listPosts(1, "essays"));
    expect(result.docs.map((doc) => doc.slug)).toEqual(["hello-world"]);
    for (const doc of result.docs) {
      expect("content" in doc).toBe(false);
      expect("html" in doc).toBe(false);
    }
    const url = requestedUrl();
    expect(url).toContain("/content/posts/summary");
    expect(url).toContain("category=essays");
  });

  it("always excludes the reserved pages category server-side", async () => {
    await Effect.runPromise(listPosts(1, null));
    expect(requestedUrl()).toContain(`excludeCategory=${PAGES_CATEGORY}`);
  });

  it("omits the category param without a filter", async () => {
    await Effect.runPromise(listPosts(1, null));
    expect(requestedUrl()).not.toContain("category=essays");
  });

  it("treats an empty filter as no filter", async () => {
    await Effect.runPromise(listPosts(1, ""));
    const url = requestedUrl();
    expect(url).not.toContain("category=essays");
    expect(url).toContain(`excludeCategory=${PAGES_CATEGORY}`);
  });

  it("fails with 400 without touching the network on an invalid category", async () => {
    await expect(Effect.runPromise(listPosts(1, "BAD SLUG!!"))).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

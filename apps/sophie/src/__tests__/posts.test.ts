import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import {
  ABOUT_SLUG,
  PAGES_CATEGORY,
  formatPublishedDate,
  formatPublishedDateTime,
  isPage,
  listPosts,
} from "../lib/posts";

const post = (slug: string, categories: ReadonlyArray<string>) => ({
  slug,
  categories: categories.map((entry) => ({ slug: entry })),
});

describe("formatPublishedDateTime", () => {
  it("formats an ISO timestamp with date and time", () => {
    expect(formatPublishedDateTime("2026-09-01T00:00:00.000Z")).toContain("2026");
    expect(formatPublishedDateTime("2026-09-01T00:00:00.000Z")).toMatch(/\d+:\d+/);
  });

  it("renders empty for null and invalid dates", () => {
    expect(formatPublishedDateTime(null)).toBe("");
    expect(formatPublishedDateTime("not-a-date")).toBe("");
  });
});

describe("isPage", () => {
  it("flags posts in the pages category", () => {
    expect(isPage(post("about", [PAGES_CATEGORY]))).toBe(true);
    expect(isPage(post("a", ["essays"]))).toBe(false);
  });

  it("names the about slug", () => {
    expect(ABOUT_SLUG).toBe("about");
  });
});

describe("formatPublishedDate", () => {
  it("formats a full date without time", () => {
    expect(formatPublishedDate("2026-09-01T00:00:00.000Z")).toContain("2026");
    expect(formatPublishedDate("2026-09-01T00:00:00.000Z")).not.toMatch(/\d+:\d+/);
  });

  it("renders empty for null and invalid dates", () => {
    expect(formatPublishedDate(null)).toBe("");
    expect(formatPublishedDate("not-a-date")).toBe("");
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

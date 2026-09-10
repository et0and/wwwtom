import { describe, expect, it } from "vitest";
import {
  ABOUT_SLUG,
  PAGES_CATEGORY,
  formatPublishedDate,
  formatPublishedDateTime,
  indexPosts,
  isPage,
  postsInCategory,
} from "../lib/posts";

const post = (slug: string, categories: ReadonlyArray<string>) => ({
  slug,
  categories: categories.map((entry) => ({ slug: entry })),
});

describe("postsInCategory", () => {
  it("returns all posts without a filter", () => {
    expect(postsInCategory([post("a", ["x"])], null)).toHaveLength(1);
  });

  it("filters posts by category slug", () => {
    const posts = [post("a", ["essays"]), post("b", ["notes"])];
    expect(postsInCategory(posts, "essays").map((entry) => entry.slug)).toEqual(["a"]);
  });
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

describe("indexPosts", () => {
  it("hides pages then filters by category", () => {
    const posts = [post("about", [PAGES_CATEGORY]), post("a", ["essays"]), post("b", ["notes"])];
    expect(indexPosts(posts, null).map((entry) => entry.slug)).toEqual(["a", "b"]);
    expect(indexPosts(posts, "essays").map((entry) => entry.slug)).toEqual(["a"]);
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

import { test, expect, type Page } from "@playwright/test";
import { entryPublishedAt } from "@tom/arena/content";
import { formatDate } from "@tom/utils/date";
import {
  fixturePosts,
  fixtureWorks,
  POSTS_PAGE_SIZE,
  newestPost,
  oldestPost,
} from "../src/fixture-stores";

/**
 * /posts — the Writing index and post pages, driven by the are.na fixture
 * store (fixtures/arena-content.json). Six fixture posts with a page size of
 * five means page 2 exists and holds exactly the oldest post; the index shows
 * titles, dates and summaries, and a detail page renders the channel's blocks.
 */

type FixtureChannel = (typeof fixturePosts)[number];

/** Post card dates, in fixture order — the same list the index renders. */
const cardDates = (posts: ReadonlyArray<FixtureChannel>): string[] =>
  posts.map((post) => formatDate(entryPublishedAt(post)));

/** Every date on the index, in DOM order. One `<time>` per post card. */
const indexDates = (page: Page) => page.locator("main a.page time");

test.describe("writing", () => {
  test("posts index lists the newest page of fixture posts", async ({ page }) => {
    await page.goto("/posts");
    await expect(page.getByRole("heading", { name: "Writing", level: 1 })).toBeVisible();

    const pageOne = fixturePosts.slice(0, POSTS_PAGE_SIZE);
    for (const post of pageOne) {
      await expect(page.getByRole("heading", { name: post.title, level: 2 })).toBeVisible();
      const summary = post.description?.plain;
      if (summary) await expect(page.getByText(summary)).toBeVisible();
    }
  });

  test("posts index shows every post's published date", async ({ page }) => {
    // The date travels adapter → web as a wire timestamp string, so this
    // fails if anything in the client revives it into a Date first: a Date
    // renders as an empty <time>, silently dropping the date from the card.
    await page.goto("/posts");
    await expect(indexDates(page)).toHaveText(cardDates(fixturePosts.slice(0, POSTS_PAGE_SIZE)));
  });

  test("posts paginates to the oldest post on page 2", async ({ page }) => {
    await page.goto("/posts");
    const next = page.getByRole("link", { name: "Next" });
    // Hover first so the router preloads page 2: a cache hit must still
    // replace the list on navigation.
    const preloaded = page.waitForResponse((response) =>
      response.url().includes("/content/arena/posts?page=2"),
    );
    await next.hover();
    await preloaded;
    await next.click();
    await expect(page).toHaveURL(/\/posts\?page=2$/);

    await expect(page.getByRole("heading", { name: oldestPost.title, level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: newestPost.title, level: 2 })).toHaveCount(0);
    await expect(indexDates(page)).toHaveText(cardDates([oldestPost]));
  });

  test("a post detail page renders title, summary and blocks", async ({ page }) => {
    await page.goto(`/posts/${newestPost.slug}`);
    await expect(page.getByRole("heading", { name: newestPost.title, level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Seven systems", level: 2, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/nightly e2e ritual/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "View on are.na" })).toHaveAttribute(
      "href",
      `https://are.na/tom/${newestPost.slug}`,
    );
    await expect(page.locator("main time")).toHaveText(cardDates([newestPost]));
  });

  test("an unknown post slug renders the not-found state", async ({ page }) => {
    await page.goto("/posts/not-a-real-post");
    await expect(page.locator("main")).toContainText("Not found");
  });

  test("the RSS feed is generated from fixture posts", async ({ page }) => {
    const response = await page.request.get("/feed.xml");
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain(newestPost.title);
    expect(body).toContain(`https://tom.so/posts/${newestPost.slug}`);
  });

  test("the sitemap lists fixture posts and works", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain(`https://tom.so/posts/${newestPost.slug}`);
    expect(body).toContain(`https://tom.so/work/${fixtureWorks[0].slug}`);
  });
});

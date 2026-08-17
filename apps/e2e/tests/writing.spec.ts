import { test, expect } from "@playwright/test";
import { fixturePosts, POSTS_PAGE_SIZE, newestPost, oldestPost } from "../src/fixture-stores";

/**
 * /posts — the Writing index and post pages, driven by the payload fixture
 * store. Six fixture posts with a page size of five means page 2 exists and
 * holds exactly the oldest post; the index shows titles and summaries, and a
 * detail page renders the converted Lexical body.
 */
test.describe("writing", () => {
  test("posts index lists the newest page of fixture posts", async ({ page }) => {
    await page.goto("/posts");
    await expect(page.getByRole("heading", { name: "Writing", level: 1 })).toBeVisible();

    const pageOne = fixturePosts.slice(0, POSTS_PAGE_SIZE);
    for (const post of pageOne) {
      await expect(page.getByRole("heading", { name: post.title, level: 2 })).toBeVisible();
      if (post.summary) await expect(page.getByText(post.summary)).toBeVisible();
    }
  });

  test("posts paginates to the oldest post on page 2", async ({ page }) => {
    await page.goto("/posts");
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/\/posts\?page=2$/);

    await expect(page.getByRole("heading", { name: oldestPost.title, level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: newestPost.title, level: 2 })).toHaveCount(0);
  });

  test("a post detail page renders title, meta and body", async ({ page }) => {
    await page.goto(`/posts/${newestPost.slug}`);
    await expect(page.getByRole("heading", { name: newestPost.title, level: 1 })).toBeVisible();
    await expect(page.getByText(/nightly e2e ritual/i)).toBeVisible();
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
    expect(body).toContain("https://tom.so/work/unlimited-blade-works");
  });
});

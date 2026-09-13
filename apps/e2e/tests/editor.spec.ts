import { test, expect, type Page, type Route } from "@playwright/test";
import { Schema } from "effect";
import {
  CmsCategoryInputSchema,
  CmsPostInputSchema,
  CmsRestoreInputSchema,
} from "@tom/schemas/cms";
import { fixturePosts, fixtureWorks } from "../src/fixture-stores";

/**
 * Camus editor e2e. GitHub OAuth cannot run headless, so every adapter call
 * is intercepted: the session route yields a fixture session (or null) and
 * /content/* yields fixture posts/works. Write bodies are captured and
 * asserted, pinning the exact API contract the editor speaks.
 */

const ADAPTER = "http://localhost:8788";

const sessionBody = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "gh@tomhackshaw.com", name: "Tom Hackshaw" },
};

const emptyList = {
  docs: [],
  totalDocs: 0,
  limit: 50,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

const postsList = { ...emptyList, docs: fixturePosts, totalDocs: fixturePosts.length };
const worksList = { ...emptyList, docs: fixtureWorks, totalDocs: fixtureWorks.length };

const stubSession = (page: Page, body: typeof sessionBody | null) =>
  page.route(`${ADAPTER}/auth/get-session`, (route: Route) => route.fulfill({ json: body }));

const json = (route: Route, body: Schema.Json, status = 200) =>
  route.fulfill({ status, json: body });

/** The editor's sign-in POST body, pinned at the adapter boundary. */
const SignInRequestSchema = Schema.Struct({
  provider: Schema.Literals(["github", "google"]),
  callbackURL: Schema.String,
  disableRedirect: Schema.Boolean,
});

test.describe("editor sign-in", () => {
  test("signed-out view shows Camus and GitHub sign-in", async ({ page }) => {
    await page.route(`${ADAPTER}/auth/get-session`, (route: Route) => json(route, null));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Camus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  });

  test("sign-in posts the provider and follows the authorize URL", async ({ page }) => {
    await page.route(`${ADAPTER}/auth/get-session`, (route: Route) => json(route, null));
    let posted: Schema.Json = null;
    await page.route(`${ADAPTER}/auth/sign-in/social`, async (route: Route) => {
      posted = route.request().postDataJSON();
      await json(route, { url: "http://127.0.0.1:5174/oauth-stub", redirect: true });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in with GitHub" }).click();
    await expect.poll(() => posted, { timeout: 8000 }).not.toBeNull();
    const signInRequest = Schema.decodeUnknownSync(SignInRequestSchema)(posted);
    expect(signInRequest.provider).toBe("github");
    expect(signInRequest.callbackURL).toContain("127.0.0.1:5174");
    await page.waitForURL("**/oauth-stub");
  });
});

test.describe("editor content", () => {
  test.beforeEach(async ({ page }) => {
    await stubSession(page, sessionBody);
    await page.route(`${ADAPTER}/content/posts?*`, (route: Route) => json(route, postsList));
    await page.route(`${ADAPTER}/content/works?*`, (route: Route) => json(route, worksList));
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
  });

  test("lists posts and switches to works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: fixturePosts[0].title })).toBeVisible();
    await page.getByRole("button", { name: "Works", exact: true }).click();
    await expect(page.getByRole("button", { name: fixtureWorks[0].title })).toBeVisible();
  });

  test("creates a post with the built input", async ({ page }) => {
    const created = { ...fixturePosts[0], id: "post-new", slug: "e2e-post", title: "E2E Post" };
    let posted: Schema.Json = null;
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
    await page.route(`${ADAPTER}/content/posts`, async (route: Route) => {
      if (route.request().method() === "POST") {
        posted = route.request().postDataJSON();
        await json(route, created);
      } else {
        await json(route, postsList);
      }
    });
    await page.goto("/");
    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Title").fill("E2E Post");
    await page.getByRole("button", { name: "Use title" }).click();
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    const postInput = Schema.decodeUnknownSync(CmsPostInputSchema)(posted);
    expect(postInput.slug).toBe("e2e-post");
    expect(postInput.title).toBe("E2E Post");
    expect(postInput.status).toBe("draft");
    expect(postInput.content).toMatchObject({ type: "doc" });
  });

  test("edits a post and saves the title", async ({ page }) => {
    const target = fixturePosts[0];
    const updated = { ...target, title: "Edited Title" };
    let saved: Schema.Json = null;
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
    await page.route(`${ADAPTER}/content/posts/${target.slug}`, async (route: Route) => {
      if (route.request().method() === "PUT") {
        saved = route.request().postDataJSON();
        await json(route, updated);
      } else {
        await json(route, target);
      }
    });
    await page.goto("/");
    await page.getByRole("button", { name: target.title }).click();
    await expect(page.getByLabel("Title")).toHaveValue(target.title);
    await page.getByLabel("Title").fill("Edited Title");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    const savedInput = Schema.decodeUnknownSync(CmsPostInputSchema)(saved);
    expect(savedInput.title).toBe("Edited Title");
    expect(savedInput.slug).toBe(target.slug);
  });

  test("quote wrap round-trips through save", async ({ page }) => {
    const target = fixturePosts[1];
    await page.route(`${ADAPTER}/content/posts/${target.slug}`, async (route: Route) => {
      if (route.request().method() === "PUT") {
        const body = Schema.decodeUnknownSync(CmsPostInputSchema)(route.request().postDataJSON());
        expect(body.content.content).toContainEqual(
          expect.objectContaining({ type: "blockquote" }),
        );
        await json(route, target);
      } else {
        await json(route, target);
      }
    });
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
    await page.goto("/");
    await page.getByRole("button", { name: target.title }).click();
    await page.locator(".tiptap-editor").click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Quote" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("empty saves fail validation without network traffic", async ({ page }) => {
    let saves = 0;
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
    await page.route(`${ADAPTER}/content/posts`, async (route: Route) => {
      if (route.request().method() === "POST") saves += 1;
      await json(route, postsList);
    });
    await page.goto("/");
    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Invalid post data")).toBeVisible();
    expect(saves).toBe(0);
  });
});

test.describe("editor categories", () => {
  test("creates a category and lists it", async ({ page }) => {
    await stubSession(page, sessionBody);
    await page.route(`${ADAPTER}/content/posts?*`, (route: Route) => json(route, emptyList));
    await page.route(`${ADAPTER}/content/works?*`, (route: Route) => json(route, emptyList));
    let posted: Schema.Json = null;
    let created = false;
    await page.route(`${ADAPTER}/content/categories`, async (route: Route) => {
      if (route.request().method() === "POST") {
        posted = route.request().postDataJSON();
        created = true;
        await json(route, { id: "cat-9", slug: "notes", title: "Notes" });
      } else {
        await json(route, created ? [{ id: "cat-9", slug: "notes", title: "Notes" }] : []);
      }
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Categories" }).click();
    await page.getByLabel("Slug").fill("notes");
    await page.getByLabel("Title").fill("Notes");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Notes · notes")).toBeVisible();
    expect(
      Schema.decodeUnknownSync(CmsCategoryInputSchema, { onExcessProperty: "error" })(posted),
    ).toEqual({
      slug: "notes",
      title: "Notes",
    });
  });
});

test.describe("editor media", () => {
  const mediaItem = {
    id: "media-1",
    key: "media/media-1/hero.webp",
    mime: "image/webp",
    width: null,
    height: null,
    alt: "Hero",
    caption: null,
    variants: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  const mediaList = { ...emptyList, limit: 100, docs: [mediaItem], totalDocs: 1 };

  test.beforeEach(async ({ page }) => {
    await stubSession(page, sessionBody);
    await page.route(`${ADAPTER}/content/posts?*`, (route: Route) => json(route, emptyList));
    await page.route(`${ADAPTER}/content/works?*`, (route: Route) => json(route, emptyList));
    await page.route(`${ADAPTER}/content/media?pageSize=*`, (route: Route) =>
      json(route, mediaList),
    );
    await page.route(`${ADAPTER}/content/media/*/file`, (route: Route) => route.abort());
  });

  test("browses, searches, and opens usage", async ({ page }) => {
    await page.route(`${ADAPTER}/content/media/media-1/usage`, (route: Route) =>
      json(route, { posts: [{ slug: "hello", title: "Hello" }], works: [] }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Media" }).click();
    await expect(page.getByText("hero.webp")).toBeVisible();
    await page.getByLabel("Search media").fill("nope");
    await expect(page.getByText("hero.webp")).toHaveCount(0);
    await page.getByLabel("Search media").fill("hero");
    await expect(page.getByText("hero.webp")).toBeVisible();
    await page.getByRole("button", { name: "Usage" }).click();
    await expect(page.getByRole("button", { name: "Post: Hello" })).toBeVisible();
  });

  test("usage navigates into the editor", async ({ page }) => {
    const target = fixturePosts[0];
    await page.route(`${ADAPTER}/content/media/media-1/usage`, (route: Route) =>
      json(route, { posts: [{ slug: target.slug, title: target.title }], works: [] }),
    );
    await page.route(`${ADAPTER}/content/posts/${target.slug}`, (route: Route) =>
      json(route, target),
    );
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
    await page.goto("/");
    await page.getByRole("button", { name: "Media" }).click();
    await page.getByRole("button", { name: "Usage" }).click();
    await page.getByRole("button", { name: `Post: ${target.title}` }).click();
    await expect(page.getByLabel("Title")).toHaveValue(target.title);
  });

  test("delete confirms and removes the asset", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    let deleted = false;
    await page.route(`${ADAPTER}/content/media/media-1/usage`, (route: Route) =>
      json(route, { posts: [], works: [] }),
    );
    await page.route(`${ADAPTER}/content/media/media-1`, async (route: Route) => {
      expect(route.request().method()).toBe("DELETE");
      deleted = true;
      await json(route, { id: "media-1" });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Media" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("hero.webp")).toHaveCount(0);
    expect(deleted).toBe(true);
  });
});

test.describe("editor history", () => {
  test("restores a revision through the panel", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const target = fixturePosts[0];
    await stubSession(page, sessionBody);
    await page.route(`${ADAPTER}/content/posts?*`, (route: Route) => json(route, postsList));
    await page.route(`${ADAPTER}/content/works?*`, (route: Route) => json(route, worksList));
    await page.route(`${ADAPTER}/content/categories`, (route: Route) => json(route, []));
    await page.route(`${ADAPTER}/content/posts/${target.slug}`, (route: Route) =>
      json(route, target),
    );
    await page.route(`${ADAPTER}/content/posts/${target.slug}/revisions`, (route: Route) =>
      json(route, [
        { id: "rev-2", createdAt: "2026-09-05T10:00:00.000Z", actor: "admin", title: "V2" },
        { id: "rev-1", createdAt: "2026-09-05T09:00:00.000Z", actor: "admin", title: "V1" },
      ]),
    );
    await page.route(`${ADAPTER}/content/posts/${target.slug}/revisions/rev-1`, (route: Route) =>
      json(route, {
        slug: target.slug,
        title: "V1",
        summary: null,
        content: { type: "doc", content: [] },
        status: "draft",
        publishedAt: null,
        heroMediaId: null,
        categoryIds: [],
        meta: { title: null, description: null, image: null },
      }),
    );
    let restored: Schema.Json = null;
    await page.route(`${ADAPTER}/content/posts/${target.slug}/restore`, async (route: Route) => {
      restored = route.request().postDataJSON();
      await json(route, target);
    });
    await page.goto("/");
    await page.getByRole("button", { name: target.title }).click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("V1")).toBeVisible();
    await page.getByText("V1").click();
    await page.getByRole("button", { name: "Restore this version" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    expect(
      Schema.decodeUnknownSync(CmsRestoreInputSchema, { onExcessProperty: "error" })(restored),
    ).toEqual({
      revisionId: "rev-1",
    });
  });
});

test.describe("editor sign-out", () => {
  test("account menu signs out back to sign-in", async ({ page }) => {
    let signedIn = true;
    await page.route(`${ADAPTER}/auth/get-session`, (route: Route) =>
      json(route, signedIn ? sessionBody : null),
    );
    await page.route(`${ADAPTER}/content/posts?*`, (route: Route) => json(route, emptyList));
    await page.route(`${ADAPTER}/content/works?*`, (route: Route) => json(route, emptyList));
    await page.route(`${ADAPTER}/auth/sign-out`, async (route: Route) => {
      signedIn = false;
      await json(route, {});
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  });
});

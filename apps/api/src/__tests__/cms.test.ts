import { describe, expect, it } from "vitest";
import type { CmsD1Binding, CmsD1Statement } from "@tom/utils/services/config";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

type Row = Record<string, string | number | null>;

const docJson = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
});

const postRow = (overrides: Row = {}): Row => ({
  id: "post-1",
  slug: "hello-world",
  title: "Hello World",
  summary: "A summary",
  content_json: docJson,
  html: "<p>Hello</p>",
  status: "published",
  published_at: "2026-09-01T00:00:00.000Z",
  hero_media_id: null,
  meta_title: null,
  meta_description: null,
  meta_image: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-02T00:00:00.000Z",
  ...overrides,
});

const workRow = (overrides: Row = {}): Row => ({
  ...postRow({ id: "work-1", slug: "hyperjam", title: "Hyperjam" }),
  ...overrides,
});

const mediaRow: Row = {
  id: "media-1",
  key: "media/hero.webp",
  mime: "image/webp",
  width: 1400,
  height: 900,
  alt: "Hero",
  caption: null,
  variants_json: JSON.stringify([{ key: "media/hero-small.webp", width: 600, format: "webp" }]),
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

const categoryRow: Row = { id: "cat-1", slug: "essays", title: "Essays" };

type Seed = {
  readonly posts: ReadonlyArray<Row>;
  readonly works: ReadonlyArray<Row>;
  readonly media: ReadonlyArray<Row>;
  readonly categories: ReadonlyArray<Row>;
  readonly links: ReadonlyArray<{ readonly postId: string; readonly categoryId: string }>;
};

/** In-memory CmsD1Binding answering the exact queries CmsService issues. */
const fakeDb = (seed: Seed): CmsD1Binding => ({
  prepare: (sql: string): CmsD1Statement => {
    const run = <T>(values: ReadonlyArray<string | number | null>) =>
      runQuery<T>(sql, values, seed);
    const statement: CmsD1Statement = {
      bind: (...values: ReadonlyArray<string | number | null>): CmsD1Statement => ({
        bind: statement.bind,
        first: async <T>() => (await run<T>(values))[0] ?? null,
        all: async <T>() => ({ results: await run<T>(values) }),
        run: async () => ({ success: true }),
      }),
      first: async <T>() => (await run<T>([]))[0] ?? null,
      all: async <T>() => ({ results: await run<T>([]) }),
      run: async () => ({ success: true }),
    };
    return statement;
  },
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({}),
});

const matchStatus = (row: Row, status: string | number | null): boolean =>
  status === "all" || row["status"] === status;

const runQuery = async <T>(
  sql: string,
  values: ReadonlyArray<string | number | null>,
  seed: Seed,
): Promise<Array<T>> => {
  const posts = sql.includes("FROM works") ? seed.works : seed.posts;
  if (sql.includes("COUNT(*)")) {
    const status = values[0] ?? "published";
    return [{ total: posts.filter((row) => matchStatus(row, status)).length } as T];
  }
  if (sql.includes("post_categories")) {
    const ids = new Set(values.map(String));
    return seed.links
      .filter((link) => ids.has(link.postId))
      .flatMap((link) =>
        seed.categories
          .filter((category) => category["id"] === link.categoryId)
          .map((category) => ({ postId: link.postId, ...category }) as T),
      );
  }
  if (sql.includes("FROM categories")) return [...seed.categories] as Array<T>;
  if (sql.includes("FROM media")) {
    return seed.media.filter((row) => row["id"] === values[0]) as Array<T>;
  }
  if (sql.includes("p.slug = ?")) {
    const status = values[1] ?? "published";
    return posts.filter((row) => row["slug"] === values[0] && matchStatus(row, status)) as Array<T>;
  }
  // List queries bind [limit, offset] or [status, status, limit, offset].
  // Works list alphabetically; posts list newest first (mirrors the SQL).
  const status = values.length > 2 ? values[0] : "published";
  const limit = Number(values.length > 2 ? values[2] : (values[0] ?? 10));
  const offset = Number(values.length > 2 ? values[3] : (values[1] ?? 0));
  const ordered = posts.filter((row) => matchStatus(row, status ?? "published"));
  if (sql.includes("FROM works")) {
    ordered.sort((a, b) =>
      String(a["title"]).localeCompare(String(b["title"]), undefined, { sensitivity: "base" }),
    );
  } else {
    ordered.sort((a, b) => String(b["published_at"]).localeCompare(String(a["published_at"])));
  }
  return ordered.slice(offset, offset + limit) as Array<T>;
};

const seedEnv = (seed: Seed) => testEnv({ CMS_D1: fakeDb(seed) });

const fullSeed: Seed = {
  posts: [
    postRow(),
    postRow({
      id: "post-2",
      slug: "second-post",
      title: "Second Post",
      published_at: "2026-08-01T00:00:00.000Z",
    }),
    postRow({ id: "post-3", slug: "draft-post", title: "Draft", status: "draft" }),
  ],
  works: [
    workRow(),
    workRow({
      id: "work-2",
      slug: "atelier",
      title: "Atelier",
      published_at: "2026-10-01T00:00:00.000Z",
    }),
  ],
  media: [mediaRow],
  categories: [categoryRow],
  links: [{ postId: "post-1", categoryId: "cat-1" }],
};

describe("cms routes", () => {
  it("returns 500 when the CMS D1 binding is missing", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/posts", testEnv()));
    expect(response.status).toBe(500);
  });

  it("lists published posts with pagination metadata", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/posts?page=1&pageSize=10", seedEnv(fullSeed)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      docs: Array<{ slug: string }>;
      totalDocs: number;
      page: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    expect(body.totalDocs).toBe(2);
    expect(body.docs.map((doc) => doc.slug)).toEqual(["hello-world", "second-post"]);
    expect(body.page).toBe(1);
    expect(body.totalPages).toBe(1);
    expect(body.hasNextPage).toBe(false);
    expect(body.hasPrevPage).toBe(false);
  });

  it("paginates the post list", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/posts?page=2&pageSize=1", seedEnv(fullSeed)),
    );
    const body = (await response.json()) as {
      docs: Array<{ slug: string }>;
      totalDocs: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    expect(body.docs.map((doc) => doc.slug)).toEqual(["second-post"]);
    expect(body.totalDocs).toBe(2);
    expect(body.totalPages).toBe(2);
    expect(body.hasPrevPage).toBe(true);
  });

  it("returns 400 for unparseable paging parameters", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/posts?page=not-a-number", seedEnv(fullSeed)),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { title: string };
    expect(body.title).toBe("Invalid paging parameters");
  });

  it("returns a post by slug with categories and parsed content", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/posts/hello-world", seedEnv(fullSeed)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      title: string;
      content: { type: string; content: Array<{ type: string }> };
      categories: Array<{ slug: string }>;
    };
    expect(body.title).toBe("Hello World");
    expect(body.content.type).toBe("doc");
    expect(body.content.content[0]?.type).toBe("paragraph");
    expect(body.categories.map((category) => category.slug)).toEqual(["essays"]);
  });

  it("returns 404 problem for unknown and draft slugs", async () => {
    const missing = await app.fetch(
      requestWithEnv("http://localhost/posts/nope", seedEnv(fullSeed)),
    );
    expect(missing.status).toBe(404);
    const draft = await app.fetch(
      requestWithEnv("http://localhost/posts/draft-post", seedEnv(fullSeed)),
    );
    expect(draft.status).toBe(404);
  });

  it("lists works alphabetically and returns a work by slug", async () => {
    const env = seedEnv(fullSeed);
    const list = await app.fetch(requestWithEnv("http://localhost/works", env));
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { docs: Array<{ slug: string }> };
    expect(listBody.docs.map((doc) => doc.slug)).toEqual(["atelier", "hyperjam"]);
    const single = await app.fetch(requestWithEnv("http://localhost/works/hyperjam", env));
    expect(single.status).toBe(200);
  });

  it("lists categories and returns media by id", async () => {
    const env = seedEnv(fullSeed);
    const categories = await app.fetch(requestWithEnv("http://localhost/categories", env));
    const categoriesBody = (await categories.json()) as Array<{ slug: string }>;
    expect(categoriesBody.map((category) => category.slug)).toEqual(["essays"]);
    const media = await app.fetch(requestWithEnv("http://localhost/media/media-1", env));
    expect(media.status).toBe(200);
    const mediaBody = (await media.json()) as { key: string };
    expect(mediaBody.key).toBe("media/hero.webp");
    const missing = await app.fetch(requestWithEnv("http://localhost/media/nope", env));
    expect(missing.status).toBe(404);
  });
});

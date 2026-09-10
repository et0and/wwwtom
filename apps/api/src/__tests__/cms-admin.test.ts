import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { CmsD1Binding, CmsD1Statement } from "@tom/utils/services/config";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { app } from "../index";
import { requireSession } from "../services/auth";
import { requestWithEnv, testEnv } from "../test/helpers";

vi.mock("../services/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/auth")>();
  const { Effect: FX } = await import("effect");
  return {
    ...original,
    requireSession: vi.fn(() => FX.fail(new Error("no session"))),
  };
});

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

type Seed = {
  readonly posts: Array<Row>;
  readonly works: Array<Row>;
  readonly categories: Array<Row>;
  readonly links: Array<{ postId: string; categoryId: string }>;
};

const matchStatus = (row: Row, status: string | number | null): boolean =>
  status === "all" || row["status"] === status;

/** In-memory CmsD1Binding answering the status-filtered CMS reads. */
const fakeDb = (seed: Seed): CmsD1Binding => ({
  prepare: (sql: string): CmsD1Statement => {
    const statement: CmsD1Statement = {
      bind: (...values: ReadonlyArray<string | number | null>): CmsD1Statement => ({
        bind: statement.bind,
        first: async <T>() => (read(sql, values, seed)[0] as T | undefined) ?? null,
        all: async <T>() => ({ results: read(sql, values, seed) as Array<T> }),
        run: async () => ({ success: true }),
      }),
      first: async <T>() => (read(sql, [], seed)[0] as T | undefined) ?? null,
      all: async <T>() => ({ results: read(sql, [], seed) as Array<T> }),
      run: async () => ({ success: true }),
    };
    return statement;
  },
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({}),
});

const read = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  seed: Seed,
): Array<Row> => {
  const rows = sql.includes("FROM works") ? seed.works : seed.posts;
  if (sql.includes("COUNT(*)")) {
    return [{ total: rows.filter((row) => matchStatus(row, values[0])).length }];
  }
  if (sql.includes("post_categories")) {
    const ids = new Set(values.map(String));
    return seed.links
      .filter((link) => ids.has(link.postId))
      .flatMap((link) =>
        seed.categories
          .filter((category) => category["id"] === link.categoryId)
          .map((category) => ({ postId: link.postId, ...category })),
      );
  }
  if (sql.includes("p.slug = ?")) {
    return rows.filter((row) => row["slug"] === values[0] && matchStatus(row, values[1]));
  }
  const limit = Number(values[2] ?? 10);
  const offset = Number(values[3] ?? 0);
  return rows
    .filter((row) => matchStatus(row, values[0]))
    .sort((a, b) => String(b["published_at"]).localeCompare(String(a["published_at"])))
    .slice(offset, offset + limit);
};

const authEnv = (seed: Seed) =>
  testEnv({
    CMS_D1: fakeDb(seed),
    BETTER_AUTH_SECRET: "test-secret-with-at-least-32-chars!!",
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
  });

const seed: Seed = {
  posts: [
    postRow(),
    postRow({ id: "post-2", slug: "draft-post", title: "Draft", status: "draft" }),
  ],
  works: [postRow({ id: "work-1", slug: "hyperjam", title: "Hyperjam" })],
  categories: [],
  links: [],
};

const anonymousSession = () =>
  Effect.fail(
    new CmsError({
      message: "No session",
      status: HttpStatus.Unauthorized,
      operation: "require_session",
    }),
  ) as never;

const adminSession = () =>
  Effect.succeed({ user: { id: "admin-1" }, session: { id: "session-1" } }) as never;

describe("cms admin reads", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockReset();
    vi.mocked(requireSession).mockReturnValue(anonymousSession());
  });

  describe("GET /posts", () => {
    it("lists published posts for anonymous readers", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/posts", authEnv(seed)));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { docs: Array<{ slug: string }>; totalDocs: number };
      expect(body.totalDocs).toBe(1);
      expect(body.docs.map((doc) => doc.slug)).toEqual(["hello-world"]);
    });

    it("ignores the status filter for anonymous readers", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts?status=all", authEnv(seed)),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { totalDocs: number }).totalDocs).toBe(1);
    });

    it("skips the session lookup without a session credential", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/posts", authEnv(seed)));
      expect(response.status).toBe(200);
      expect(vi.mocked(requireSession)).not.toHaveBeenCalled();
    });

    it("skips the session lookup on every read without a credential", async () => {
      for (const path of [
        "/posts/summary",
        "/works",
        "/works/summary",
        "/posts/hello-world",
        "/works/hyperjam",
      ]) {
        vi.mocked(requireSession).mockClear();
        const response = await app.fetch(requestWithEnv(`http://localhost${path}`, authEnv(seed)));
        expect(response.status).toBe(200);
        expect(vi.mocked(requireSession)).not.toHaveBeenCalled();
      }
    });

    it("checks the session on bearer credentials", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts", authEnv(seed), {
          headers: { authorization: "Bearer test-token" },
        }),
      );
      expect(response.status).toBe(200);
      expect(vi.mocked(requireSession)).toHaveBeenCalled();
    });

    it("lists everything for admins by default", async () => {
      vi.mocked(requireSession).mockReturnValue(adminSession());
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts", authEnv(seed), {
          headers: { cookie: "better-auth.session_token=test" },
        }),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { totalDocs: number }).totalDocs).toBe(2);
    });

    it("filters drafts for admins on request", async () => {
      vi.mocked(requireSession).mockReturnValue(adminSession());
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts?status=draft", authEnv(seed), {
          headers: { cookie: "better-auth.session_token=test" },
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { docs: Array<{ slug: string }> };
      expect(body.docs.map((doc) => doc.slug)).toEqual(["draft-post"]);
    });
  });

  describe("GET /posts/:slug", () => {
    it("hides drafts from anonymous readers", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts/draft-post", authEnv(seed)),
      );
      expect(response.status).toBe(HttpStatus.NotFound);
    });

    it("shows drafts to admins", async () => {
      vi.mocked(requireSession).mockReturnValue(adminSession());
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts/draft-post", authEnv(seed), {
          headers: { cookie: "better-auth.session_token=test" },
        }),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { slug: string }).slug).toBe("draft-post");
    });
  });

  describe("unconfigured auth", () => {
    it("falls back to published-only when auth secrets are missing", async () => {
      const env = testEnv({ CMS_D1: fakeDb(seed) });
      const response = await app.fetch(requestWithEnv("http://localhost/posts?status=all", env));
      expect(response.status).toBe(200);
      expect(((await response.json()) as { totalDocs: number }).totalDocs).toBe(1);
    });
  });
});

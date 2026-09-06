import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { CmsCategoryId, CmsPostInput, CmsSlug, CmsWorkInput } from "@tom/schemas/cms";
import type { CmsD1Binding, CmsD1Statement, CmsR2Binding } from "@tom/utils/services/config";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
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
    requireSession: vi.fn(() =>
      FX.succeed({ user: { id: "admin-1", email: "gh@tomhackshaw.com" } }),
    ),
  };
});

type Row = Record<string, string | number | null>;

type Store = {
  readonly posts: Array<Row>;
  readonly works: Array<Row>;
  readonly categories: Array<Row>;
  readonly media: Array<Row>;
  readonly links: Array<{ postId: string; categoryId: string }>;
  readonly revisions: Array<Row>;
  revisionSeq: number;
};

const emptyStore = (): Store => ({
  posts: [],
  works: [],
  categories: [],
  media: [],
  links: [],
  revisions: [],
  revisionSeq: 0,
});

const tableFor = (sql: string, store: Store): Array<Row> => {
  if (sql.includes("FROM works")) return store.works;
  if (sql.includes("FROM categories")) return store.categories;
  if (sql.includes("FROM media")) return store.media;
  return store.posts;
};

const revisionOrder = (rows: Array<Row>): Array<Row> =>
  [...rows].sort((a, b) => {
    const time = String(b["created_at"]).localeCompare(String(a["created_at"]));
    return time !== 0 ? time : Number(b["__seq"]) - Number(a["__seq"]);
  });

const readRevisions = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): Array<Row> | undefined => {
  if (!sql.includes("FROM revisions")) return undefined;
  const scoped = store.revisions.filter(
    (row) => row["entity_type"] === values[0] && row["entity_id"] === values[1],
  );
  const single = values.length > 2 ? scoped.filter((row) => row["id"] === values[2]) : scoped;
  return revisionOrder(single);
};

const readCategoryLinks = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): Array<Row> | undefined => {
  if (sql.includes("post_categories") && sql.includes("JOIN")) {
    const ids = new Set(values.map(String));
    return store.links
      .filter((link) => ids.has(link.postId))
      .flatMap((link) =>
        store.categories
          .filter((category) => category["id"] === link.categoryId)
          .map((category) => ({ postId: link.postId, ...category })),
      );
  }
  if (sql.includes("FROM categories WHERE id IN")) {
    const ids = new Set(values.map(String));
    return store.categories.filter((row) => ids.has(String(row["id"])));
  }
  return undefined;
};

const readDocRow = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): Array<Row> | undefined => {
  if (sql.includes("slug = ?")) {
    return tableFor(sql, store).filter((row) => row["slug"] === values[0]);
  }
  if (sql.includes("WHERE p.id = ?")) {
    return tableFor(sql, store).filter((row) => row["id"] === values[0]);
  }
  if (sql.includes("FROM media")) {
    return store.media.filter((row) => row["id"] === values[0]);
  }
  return undefined;
};

const readMediaLibrary = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): Array<Row> | undefined => {
  if (sql.includes("FROM media") && sql.includes("COUNT(*)")) {
    return [{ total: store.media.length }];
  }
  if (sql.includes("FROM media") && sql.includes("ORDER BY created_at")) {
    const limit = Number(values[0] ?? 50);
    const offset = Number(values[1] ?? 0);
    return [...store.media]
      .sort((a, b) => String(b["created_at"]).localeCompare(String(a["created_at"])))
      .slice(offset, offset + limit);
  }
  if (sql.includes("instr(content_json")) {
    const id = values[0];
    const marker = String(values[1]);
    return tableFor(sql, store)
      .filter((row) => row["hero_media_id"] === id || String(row["content_json"]).includes(marker))
      .map((row) => ({ slug: row["slug"], title: row["title"] }));
  }
  return undefined;
};

const read = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): Array<Row> => {
  const revisions = readRevisions(sql, values, store);
  if (revisions !== undefined) return revisions;
  const links = readCategoryLinks(sql, values, store);
  if (links !== undefined) return links;
  const media = readMediaLibrary(sql, values, store);
  if (media !== undefined) return media;
  return readDocRow(sql, values, store) ?? [];
};

const insertEntry = (
  columns: ReadonlyArray<string>,
  values: ReadonlyArray<string | number | null>,
): Row => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? null]));

const writeRevision = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): boolean => {
  if (sql.startsWith("INSERT INTO revisions")) {
    store.revisionSeq += 1;
    store.revisions.push({
      ...insertEntry(
        ["id", "entity_type", "entity_id", "snapshot_json", "actor", "created_at"],
        values,
      ),
      __seq: store.revisionSeq,
    });
    return true;
  }
  if (sql.startsWith("DELETE FROM revisions")) {
    const keep = new Set(
      revisionOrder(
        store.revisions.filter(
          (row) => row["entity_type"] === values[0] && row["entity_id"] === values[1],
        ),
      )
        .slice(0, Number(values[4]))
        .map((row) => row["id"]),
    );
    store.revisions.splice(
      0,
      store.revisions.length,
      ...store.revisions.filter(
        (row) =>
          !(row["entity_type"] === values[0] && row["entity_id"] === values[1]) ||
          keep.has(row["id"]),
      ),
    );
    return true;
  }
  return false;
};

const deleteTableRow = (table: Array<Row>, id: string | number | null): void => {
  const index = table.findIndex((row) => row["id"] === id);
  if (index >= 0) table.splice(index, 1);
};

const deleteRow = (
  sql: string,
  values: ReadonlyArray<string | number | null>,
  store: Store,
): boolean => {
  if (sql.startsWith("DELETE FROM post_categories")) {
    store.links.splice(
      0,
      store.links.length,
      ...store.links.filter((link) => link.postId !== values[0]),
    );
    return true;
  }
  if (sql.startsWith("DELETE FROM posts")) {
    deleteTableRow(store.posts, values[0] ?? null);
    return true;
  }
  if (sql.startsWith("DELETE FROM works")) {
    deleteTableRow(store.works, values[0] ?? null);
    return true;
  }
  if (sql.startsWith("DELETE FROM categories")) {
    deleteTableRow(store.categories, values[0] ?? null);
    return true;
  }
  if (sql.startsWith("DELETE FROM media")) {
    deleteTableRow(store.media, values[0] ?? null);
    return true;
  }
  return false;
};

const write = (sql: string, values: ReadonlyArray<string | number | null>, store: Store): void => {
  if (writeRevision(sql, values, store)) return;
  if (sql.startsWith("INSERT INTO posts") || sql.startsWith("INSERT INTO works")) {
    const table = sql.includes("INTO works") ? store.works : store.posts;
    table.push(
      insertEntry(
        [
          "id",
          "slug",
          "title",
          "summary",
          "content_json",
          "html",
          "status",
          "published_at",
          "hero_media_id",
          "meta_title",
          "meta_description",
          "meta_image",
          "created_at",
          "updated_at",
        ],
        values,
      ),
    );
    return;
  }
  if (sql.startsWith("INSERT INTO post_categories")) {
    store.links.push({ postId: String(values[0]), categoryId: String(values[1]) });
    return;
  }
  if (sql.startsWith("INSERT INTO categories")) {
    store.categories.push(insertEntry(["id", "slug", "title"], values));
    return;
  }
  if (sql.startsWith("INSERT INTO media")) {
    store.media.push({
      ...insertEntry(["id", "key", "mime", "alt", "caption", "created_at", "updated_at"], values),
      width: null,
      height: null,
      variants_json: "[]",
    });
    return;
  }
  if (sql.startsWith("UPDATE posts SET") || sql.startsWith("UPDATE works SET")) {
    const table = sql.includes("works SET") ? store.works : store.posts;
    const row = table.find((entry) => entry["id"] === values[values.length - 1]);
    if (!row) return;
    const columns = [
      "title",
      "summary",
      "content_json",
      "html",
      "status",
      "published_at",
      "hero_media_id",
      "meta_title",
      "meta_description",
      "meta_image",
      "updated_at",
    ];
    columns.forEach((column, index) => {
      row[column] = values[index] ?? null;
    });
    return;
  }
  deleteRow(sql, values, store);
};

/** Stateful in-memory CmsD1Binding executing the exact writes CmsService issues. */
const fakeDb = (store: Store): CmsD1Binding => ({
  prepare: (sql: string): CmsD1Statement => {
    const statement: CmsD1Statement = {
      bind: (...values: ReadonlyArray<string | number | null>): CmsD1Statement => ({
        bind: statement.bind,
        first: async <T>() => (read(sql, values, store)[0] as T | undefined) ?? null,
        all: async <T>() => ({ results: read(sql, values, store) as Array<T> }),
        run: async () => {
          write(sql, values, store);
          return { success: true };
        },
      }),
      first: async <T>() => (read(sql, [], store)[0] as T | undefined) ?? null,
      all: async <T>() => ({ results: read(sql, [], store) as Array<T> }),
      run: async () => {
        write(sql, [], store);
        return { success: true };
      },
    };
    return statement;
  },
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({}),
});

const toBytes = (value: ArrayBuffer | Uint8Array | string): ArrayBuffer => {
  if (value instanceof Uint8Array) return Uint8Array.from(value).buffer;
  if (value instanceof ArrayBuffer) return value;
  return new TextEncoder().encode(value).buffer;
};

const fakeR2 = (files: Map<string, { bytes: ArrayBuffer; mime: string }>): CmsR2Binding => ({
  put: async (key, value, options) => {
    files.set(key, {
      bytes: toBytes(value),
      mime: options?.httpMetadata?.contentType ?? "application/octet-stream",
    });
    return { key };
  },
  get: async (key) => {
    const file = files.get(key);
    if (!file) return null;
    return { key, size: file.bytes.byteLength, arrayBuffer: async () => file.bytes };
  },
  delete: async (key) => {
    files.delete(key);
  },
});

// Real magic bytes: uploads must match their claimed Content-Type.
const pngBytes = (): ArrayBuffer =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41]).buffer as ArrayBuffer;
const webpBytes = (): ArrayBuffer =>
  new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x41])
    .buffer as ArrayBuffer;

const validPostBase: CmsPostInput = {
  slug: "hello-world" as CmsSlug,
  title: "Hello World",
  summary: "A summary",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
  },
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  categoryIds: ["cat-1" as CmsCategoryId],
  meta: { title: null, description: null, image: null },
};

const postInput = (overrides: Partial<CmsPostInput> = {}): CmsPostInput => ({
  ...validPostBase,
  ...overrides,
});

const validWorkBase: CmsWorkInput = {
  slug: "hyperjam" as CmsSlug,
  title: "Hyperjam",
  summary: "A summary",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
  },
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  meta: { title: null, description: null, image: null },
};

const workInput = (overrides: Partial<CmsWorkInput> = {}): CmsWorkInput => ({
  ...validWorkBase,
  ...overrides,
});

const setup = () => {
  const store = emptyStore();
  store.categories.push({ id: "cat-1", slug: "essays", title: "Essays" });
  const files = new Map<string, { bytes: ArrayBuffer; mime: string }>();
  const env = testEnv({
    CMS_D1: fakeDb(store),
    CMS_MEDIA: fakeR2(files),
    BETTER_AUTH_SECRET: "test-secret-with-at-least-32-chars!!",
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    CMS_ADMIN_EMAILS: "gh@tomhackshaw.com",
    ADAPTER_URL: "http://localhost:8788",
  });
  return { store, files, env };
};

const authedJson = <B>(
  url: string,
  env: ReturnType<typeof testEnv>,
  method: string,
  body?: B,
): Request =>
  requestWithEnv(url, env, {
    method,
    headers: {
      [INTERNAL_TOKEN_HEADER]: "test-internal-token",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("cms write routes", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockReset();
    vi.mocked(requireSession).mockReturnValue(
      Effect.succeed({ user: { id: "admin-1", email: "gh@tomhackshaw.com" } }) as never,
    );
  });

  describe("POST /posts", () => {
    it("creates a draft with rendered HTML and category links", async () => {
      const { store, env } = setup();
      const response = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", postInput()),
      );
      expect(response.status).toBe(200);
      const post = (await response.json()) as {
        slug: string;
        html: string;
        status: string;
        categories: Array<{ id: string }>;
      };
      expect(post.slug).toBe("hello-world");
      expect(post.html).toBe("<p>Hello</p>");
      expect(post.status).toBe("draft");
      expect(post.categories.map((category) => category.id)).toEqual(["cat-1"]);
      expect(store.posts).toHaveLength(1);
      expect(store.links).toEqual([{ postId: store.posts[0]?.["id"], categoryId: "cat-1" }]);
    });

    it("rejects a taken slug with 409", async () => {
      const { env } = setup();
      await app.fetch(authedJson("http://localhost/posts", env, "POST", postInput()));
      const response = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", postInput()),
      );
      expect(response.status).toBe(HttpStatus.Conflict);
    });

    it("rejects an invalid body with 400", async () => {
      const { store, env } = setup();
      const response = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", { ...postInput(), title: 42 }),
      );
      expect(response.status).toBe(HttpStatus.BadRequest);
      expect(store.posts).toHaveLength(0);
    });

    it("rejects an unknown category id with 400", async () => {
      const { store, env } = setup();
      const response = await app.fetch(
        authedJson(
          "http://localhost/posts",
          env,
          "POST",
          postInput({ categoryIds: ["nope" as CmsCategoryId] }),
        ),
      );
      expect(response.status).toBe(HttpStatus.BadRequest);
      expect(store.posts).toHaveLength(1);
      expect(store.links).toHaveLength(0);
    });
  });

  describe("PUT /posts/:slug", () => {
    it("updates the post and replaces category links", async () => {
      const { store, env } = setup();
      await app.fetch(authedJson("http://localhost/posts", env, "POST", postInput()));
      const response = await app.fetch(
        authedJson(
          "http://localhost/posts/hello-world",
          env,
          "PUT",
          postInput({
            title: "Hello Again",
            status: "published",
            publishedAt: "2026-09-05T00:00:00.000Z",
            categoryIds: [],
          }),
        ),
      );
      expect(response.status).toBe(200);
      const post = (await response.json()) as { title: string; status: string };
      expect(post.title).toBe("Hello Again");
      expect(post.status).toBe("published");
      expect(store.links).toHaveLength(0);
    });

    it("rejects a slug change with 400", async () => {
      const { env } = setup();
      await app.fetch(authedJson("http://localhost/posts", env, "POST", postInput()));
      const response = await app.fetch(
        authedJson(
          "http://localhost/posts/hello-world",
          env,
          "PUT",
          postInput({ slug: "other" as CmsSlug }),
        ),
      );
      expect(response.status).toBe(HttpStatus.BadRequest);
    });

    it("returns 404 for a missing post", async () => {
      const { env } = setup();
      const response = await app.fetch(
        authedJson(
          "http://localhost/posts/missing",
          env,
          "PUT",
          postInput({ slug: "missing" as CmsSlug }),
        ),
      );
      expect(response.status).toBe(HttpStatus.NotFound);
    });
  });

  describe("DELETE /posts/:slug", () => {
    it("deletes the post and returns its id", async () => {
      const { store, env } = setup();
      const created = (await (
        await app.fetch(authedJson("http://localhost/posts", env, "POST", postInput()))
      ).json()) as { id: string };
      const response = await app.fetch(
        authedJson("http://localhost/posts/hello-world", env, "DELETE"),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: created.id });
      expect(store.posts).toHaveLength(0);
    });

    it("returns 404 for a missing post", async () => {
      const { env } = setup();
      const response = await app.fetch(authedJson("http://localhost/posts/missing", env, "DELETE"));
      expect(response.status).toBe(HttpStatus.NotFound);
    });
  });

  describe("works", () => {
    it("creates and updates a work", async () => {
      const { env } = setup();
      const created = await app.fetch(
        authedJson("http://localhost/works", env, "POST", workInput()),
      );
      expect(created.status).toBe(200);
      const updated = await app.fetch(
        authedJson(
          "http://localhost/works/hyperjam",
          env,
          "PUT",
          workInput({ title: "Hyperjam 2" }),
        ),
      );
      expect(updated.status).toBe(200);
      expect(((await updated.json()) as { title: string }).title).toBe("Hyperjam 2");
      const deleted = await app.fetch(authedJson("http://localhost/works/hyperjam", env, "DELETE"));
      expect(deleted.status).toBe(200);
    });
  });

  describe("categories", () => {
    it("creates and deletes a category", async () => {
      const { store, env } = setup();
      const created = await app.fetch(
        authedJson("http://localhost/categories", env, "POST", { slug: "notes", title: "Notes" }),
      );
      expect(created.status).toBe(200);
      expect(store.categories).toHaveLength(2);
      const duplicate = await app.fetch(
        authedJson("http://localhost/categories", env, "POST", { slug: "notes", title: "Notes" }),
      );
      expect(duplicate.status).toBe(HttpStatus.Conflict);
      const deleted = await app.fetch(
        authedJson("http://localhost/categories/notes", env, "DELETE"),
      );
      expect(deleted.status).toBe(200);
      expect(store.categories).toHaveLength(1);
    });
  });

  describe("POST /media", () => {
    const uploadRequest = (env: ReturnType<typeof testEnv>, file: File): Request =>
      requestWithEnv("http://localhost/media", env, {
        method: "POST",
        headers: { [INTERNAL_TOKEN_HEADER]: "test-internal-token" },
        body: (() => {
          const form = new FormData();
          form.append("file", file);
          form.append("alt", "Hero image");
          return form;
        })(),
      });

    it("uploads a file to R2, stores metadata, and serves the bytes", async () => {
      const { store, files, env } = setup();
      const bytes = webpBytes();
      const upload = await app.fetch(
        uploadRequest(env, new File([bytes], "hero.webp", { type: "image/webp" })),
      );
      expect(upload.status).toBe(200);
      const media = (await upload.json()) as {
        id: string;
        key: string;
        mime: string;
        alt: string | null;
      };
      expect(media.mime).toBe("image/webp");
      expect(media.alt).toBe("Hero image");
      expect(media.key.startsWith(`media/${media.id}/`)).toBe(true);
      expect(files.has(media.key)).toBe(true);
      expect(store.media).toHaveLength(1);

      const file = await app.fetch(requestWithEnv(`http://localhost/media/${media.id}/file`, env));
      expect(file.status).toBe(200);
      expect(file.headers.get("Content-Type")).toBe("image/webp");
      expect(file.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(file.headers.get("Content-Security-Policy")).toBe("sandbox");
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(bytes));
    });

    it("rejects unsupported types and missing files with 400", async () => {
      const { env } = setup();
      const badType = await app.fetch(
        uploadRequest(env, new File(["x"], "run.exe", { type: "application/x-msdownload" })),
      );
      expect(badType.status).toBe(HttpStatus.BadRequest);
      const form = new FormData();
      form.append("alt", "no file");
      const missing = await app.fetch(
        requestWithEnv("http://localhost/media", env, {
          method: "POST",
          headers: { [INTERNAL_TOKEN_HEADER]: "test-internal-token" },
          body: form,
        }),
      );
      expect(missing.status).toBe(HttpStatus.BadRequest);
    });

    it("rejects SVG uploads and byte/type mismatches with 400", async () => {
      const { env } = setup();
      const svgBytes = new TextEncoder().encode("<svg></svg>").buffer as ArrayBuffer;
      const svg = await app.fetch(
        uploadRequest(env, new File([svgBytes], "x.svg", { type: "image/svg+xml" })),
      );
      expect(svg.status).toBe(HttpStatus.BadRequest);
      const mismatch = await app.fetch(
        uploadRequest(env, new File([pngBytes()], "a.jpg", { type: "image/jpeg" })),
      );
      expect(mismatch.status).toBe(HttpStatus.BadRequest);
      const mismatchBody = (await mismatch.json()) as { title: string };
      expect(mismatchBody.title).toContain("do not match");
    });

    it("deletes the object and the row", async () => {
      const { store, files, env } = setup();
      const bytes = pngBytes();
      const upload = (await (
        await app.fetch(uploadRequest(env, new File([bytes], "a.png", { type: "image/png" })))
      ).json()) as { id: string; key: string };
      const deleted = await app.fetch(
        authedJson(`http://localhost/media/${upload.id}`, env, "DELETE"),
      );
      expect(deleted.status).toBe(200);
      expect(await deleted.json()).toEqual({ id: upload.id });
      expect(store.media).toHaveLength(0);
      expect(files.has(upload.key)).toBe(false);
    });
  });

  describe("post revisions", () => {
    type RevisionMeta = {
      id: string;
      createdAt: string;
      actor: string | null;
      title: string;
    };

    const createAndUpdate = async (env: ReturnType<typeof testEnv>) => {
      const created = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", postInput()),
      );
      expect(created.status).toBe(200);
      const updated = await app.fetch(
        authedJson(
          "http://localhost/posts/hello-world",
          env,
          "PUT",
          postInput({ title: "Hello Again" }),
        ),
      );
      expect(updated.status).toBe(200);
    };

    const listRevisions = async (env: ReturnType<typeof testEnv>) => {
      const response = await app.fetch(
        authedJson("http://localhost/posts/hello-world/revisions", env, "GET"),
      );
      expect(response.status).toBe(200);
      return (await response.json()) as Array<RevisionMeta>;
    };

    it("records create and update with the author, newest first", async () => {
      const { store, env } = setup();
      await createAndUpdate(env);
      expect(store.revisions).toHaveLength(2);
      const metas = await listRevisions(env);
      expect(metas.map((meta) => meta.title)).toEqual(["Hello Again", "Hello World"]);
      expect(metas[0]?.actor).toBe("gh@tomhackshaw.com");
    });

    it("restores a snapshot as a new revision", async () => {
      const { env } = setup();
      await createAndUpdate(env);
      const metas = await listRevisions(env);
      const original = metas.find((meta) => meta.title === "Hello World");
      expect(original).toBeDefined();
      if (!original) return;
      const snapshot = (await (
        await app.fetch(
          authedJson(`http://localhost/posts/hello-world/revisions/${original.id}`, env, "GET"),
        )
      ).json()) as { title: string; categoryIds: Array<string> };
      expect(snapshot.title).toBe("Hello World");
      expect(snapshot.categoryIds).toEqual(["cat-1"]);
      const restored = await app.fetch(
        authedJson("http://localhost/posts/hello-world/restore", env, "POST", {
          revisionId: original.id,
        }),
      );
      expect(restored.status).toBe(200);
      expect(((await restored.json()) as { title: string }).title).toBe("Hello World");
      const after = await listRevisions(env);
      expect(after).toHaveLength(3);
      expect(after[0]?.title).toBe("Hello World");
    });

    it("prunes past twenty revisions", async () => {
      const { env } = setup();
      const created = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", postInput()),
      );
      expect(created.status).toBe(200);
      for (let index = 0; index < 21; index += 1) {
        const updated = await app.fetch(
          authedJson(
            "http://localhost/posts/hello-world",
            env,
            "PUT",
            postInput({ title: `Edit ${index}` }),
          ),
        );
        expect(updated.status).toBe(200);
      }
      const metas = await listRevisions(env);
      expect(metas).toHaveLength(20);
      expect(metas[0]?.title).toBe("Edit 20");
    });

    it("404s on unknown slugs and revision ids", async () => {
      const { env } = setup();
      const missingDoc = await app.fetch(
        authedJson("http://localhost/posts/nope/revisions", env, "GET"),
      );
      expect(missingDoc.status).toBe(HttpStatus.NotFound);
      await createAndUpdate(env);
      const missingRevision = await app.fetch(
        authedJson("http://localhost/posts/hello-world/revisions/nope", env, "GET"),
      );
      expect(missingRevision.status).toBe(HttpStatus.NotFound);
      const missingRestore = await app.fetch(
        authedJson("http://localhost/posts/hello-world/restore", env, "POST", {
          revisionId: "nope",
        }),
      );
      expect(missingRestore.status).toBe(HttpStatus.NotFound);
    });
  });

  describe("work revisions", () => {
    it("records, lists, and restores work snapshots", async () => {
      const { env } = setup();
      const created = await app.fetch(
        authedJson("http://localhost/works", env, "POST", workInput()),
      );
      expect(created.status).toBe(200);
      const updated = await app.fetch(
        authedJson(
          "http://localhost/works/hyperjam",
          env,
          "PUT",
          workInput({ title: "Hyperjam 2" }),
        ),
      );
      expect(updated.status).toBe(200);
      const listed = await app.fetch(
        authedJson("http://localhost/works/hyperjam/revisions", env, "GET"),
      );
      expect(listed.status).toBe(200);
      const metas = (await listed.json()) as Array<{ id: string; title: string }>;
      expect(metas.map((meta) => meta.title)).toEqual(["Hyperjam 2", "Hyperjam"]);
      const restored = await app.fetch(
        authedJson("http://localhost/works/hyperjam/restore", env, "POST", {
          revisionId: metas[1]?.id,
        }),
      );
      expect(restored.status).toBe(200);
      expect(((await restored.json()) as { title: string }).title).toBe("Hyperjam");
    });
  });

  describe("media library", () => {
    const mediaRow = (id: string, createdAt: string): Row => ({
      id,
      key: `media/${id}/photo.webp`,
      mime: "image/webp",
      width: null,
      height: null,
      alt: null,
      caption: null,
      variants_json: "[]",
      created_at: createdAt,
      updated_at: createdAt,
    });

    const librarySetup = () => {
      const { store, env } = setup();
      store.media.push(mediaRow("media-1", "2026-09-01T00:00:00.000Z"));
      store.media.push(mediaRow("media-2", "2026-09-05T00:00:00.000Z"));
      return { store, env };
    };

    it("lists media newest first", async () => {
      const { env } = librarySetup();
      const response = await app.fetch(authedJson("http://localhost/media", env, "GET"));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { docs: Array<{ id: string }>; totalDocs: number };
      expect(body.totalDocs).toBe(2);
      expect(body.docs.map((doc) => doc.id)).toEqual(["media-2", "media-1"]);
    });

    it("reports posts and works using an asset", async () => {
      const { store, env } = librarySetup();
      store.posts.push({
        id: "post-9",
        slug: "with-image",
        title: "With Image",
        summary: null,
        // Spaced JSON like the Payload clone wrote; usage still matches.
        content_json: `{"type": "doc", "content": [{"type": "cmsMedia", "attrs": {"mediaId": "media-1"}}]}`,
        html: "",
        status: "published",
        published_at: null,
        hero_media_id: "media-2",
        meta_title: null,
        meta_description: null,
        meta_image: null,
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
      });
      const first = await app.fetch(authedJson("http://localhost/media/media-1/usage", env, "GET"));
      expect(first.status).toBe(200);
      expect(await first.json()).toEqual({
        posts: [{ slug: "with-image", title: "With Image" }],
        works: [],
      });
      const second = await app.fetch(
        authedJson("http://localhost/media/media-2/usage", env, "GET"),
      );
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual({
        posts: [{ slug: "with-image", title: "With Image" }],
        works: [],
      });
    });

    it("404s usage for unknown assets", async () => {
      const { env } = librarySetup();
      const response = await app.fetch(authedJson("http://localhost/media/nope/usage", env, "GET"));
      expect(response.status).toBe(HttpStatus.NotFound);
    });

    it("refuses to delete media referenced by posts with 409", async () => {
      const { store, files, env } = setup();
      const key = "media/media-9/photo.webp";
      store.media.push({
        id: "media-9",
        key,
        mime: "image/webp",
        width: null,
        height: null,
        alt: null,
        caption: null,
        variants_json: "[]",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
      });
      files.set(key, { bytes: webpBytes(), mime: "image/webp" });
      store.posts.push({
        id: "post-9",
        slug: "with-image",
        title: "With Image",
        summary: null,
        content_json: `{"type": "doc", "content": [{"text": "uses media-9"}]}`,
        html: "",
        status: "published",
        published_at: null,
        hero_media_id: null,
        meta_title: null,
        meta_description: null,
        meta_image: null,
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
      });
      const deleted = await app.fetch(authedJson("http://localhost/media/media-9", env, "DELETE"));
      expect(deleted.status).toBe(HttpStatus.Conflict);
      expect(store.media).toHaveLength(1);
      expect(files.has(key)).toBe(true);
    });
  });

  describe("authorization", () => {
    it("rejects writes without the internal token", async () => {
      const { env } = setup();
      const response = await app.fetch(
        requestWithEnv("http://localhost/posts", env, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postInput()),
        }),
      );
      expect(response.status).toBe(HttpStatus.Unauthorized);
    });

    it("rejects writes without a session", async () => {
      const { env } = setup();
      vi.mocked(requireSession).mockReturnValueOnce(
        Effect.fail(
          new CmsError({
            message: "No session",
            status: HttpStatus.Unauthorized,
            operation: "require_session",
          }),
        ) as never,
      );
      const response = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", postInput()),
      );
      expect(response.status).toBe(HttpStatus.Unauthorized);
    });

    it("rejects writes from sessions outside the admin allowlist", async () => {
      const { env } = setup();
      env.CMS_ADMIN_EMAILS = "someone-else@example.com";
      const response = await app.fetch(
        authedJson("http://localhost/posts", env, "POST", postInput()),
      );
      expect(response.status).toBe(HttpStatus.Forbidden);
    });
  });
});

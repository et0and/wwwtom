import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { TiptapDoc } from "@tom/schemas/cms";
import {
  createCategory,
  deleteCategory,
  deletePost,
  getPost,
  listCategories,
  listPosts,
  listWorks,
  mediaFileUrl,
  savePost,
  toPostInput,
  toWorkInput,
  uploadMedia,
} from "../content";
import { runClient } from "../api";
import type { ContentFields } from "../content";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = <B>(body: B, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const doc: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
};

const post = {
  id: "post-1",
  slug: "hello-world",
  title: "Hello World",
  summary: null,
  content: doc,
  html: "<p>Hi</p>",
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  categories: [],
  meta: { title: null, description: null, image: null },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const fields: ContentFields = {
  slug: "hello-world",
  title: "Hello World",
  summary: "",
  status: "draft",
  publishedAt: "",
};

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ];
  return { url, init };
};

describe("editor content client", () => {
  it("lists posts with the admin status filter", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        docs: [post],
        totalDocs: 1,
        limit: 50,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      }),
    );
    const list = await runClient(listPosts(1));
    expect(list.totalDocs).toBe(1);
    expect(lastCall().url).toBe(
      "http://localhost:8788/content/posts?status=all&page=1&pageSize=10",
    );
  });

  it("lists posts in a category", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        docs: [],
        totalDocs: 0,
        limit: 50,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      }),
    );
    await runClient(listPosts(1, "pages"));
    expect(lastCall().url).toBe(
      "http://localhost:8788/content/posts?status=all&page=1&pageSize=10&category=pages",
    );
  });

  it("lists works", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        docs: [],
        totalDocs: 0,
        limit: 50,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      }),
    );
    await runClient(listWorks(1));
    expect(lastCall().url).toBe(
      "http://localhost:8788/content/works?status=all&page=1&pageSize=10",
    );
  });

  it("gets a post by slug", async () => {
    fetchMock.mockResolvedValue(jsonResponse(post));
    const loaded = await runClient(getPost("hello-world"));
    expect(loaded.title).toBe("Hello World");
    expect(lastCall().url).toBe("http://localhost:8788/content/posts/hello-world");
  });

  it("creates posts with POST", async () => {
    const input = await runClient(toPostInput(fields, doc, []));
    fetchMock.mockResolvedValueOnce(jsonResponse(post));
    await runClient(savePost(null, input));
    expect(lastCall().url).toBe("http://localhost:8788/content/posts");
    expect(lastCall().init.method).toBe("POST");
    expect(JSON.parse(String(lastCall().init.body)).slug).toBe("hello-world");
  });

  it("updates posts with PUT", async () => {
    const input = await runClient(toPostInput(fields, doc, []));
    fetchMock.mockResolvedValueOnce(jsonResponse(post));
    await runClient(savePost("hello-world", input));
    expect(lastCall().url).toBe("http://localhost:8788/content/posts/hello-world");
    expect(lastCall().init.method).toBe("PUT");
  });

  it("rejects empty slugs before any network call", async () => {
    const error = await runClient(toPostInput({ ...fields, slug: "" }, doc, []).pipe(Effect.flip));
    expect(error.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds work inputs without categories", async () => {
    const input = await runClient(toWorkInput(fields, doc));
    expect(input.slug).toBe("hello-world");
    expect("categoryIds" in input).toBe(false);
  });

  it("deletes posts", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "post-1" }));
    const deleted = await runClient(deletePost("hello-world"));
    expect(deleted).toEqual({ id: "post-1" });
    expect(lastCall().init.method).toBe("DELETE");
  });

  it("lists categories", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: "cat-1", slug: "essays", title: "Essays" }]));
    const categories = await runClient(listCategories());
    expect(categories).toHaveLength(1);
  });

  it("creates categories with POST", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "cat-2", slug: "notes", title: "Notes" }));
    await runClient(createCategory("notes", "Notes"));
    expect(lastCall().init.method).toBe("POST");
  });

  it("deletes categories", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "cat-2" }));
    await runClient(deleteCategory("notes"));
    expect(lastCall().url).toBe("http://localhost:8788/content/categories/notes");
  });

  it("uploads media as multipart", async () => {
    const media = {
      id: "media-1",
      key: "media/media-1/a.png",
      mime: "image/png",
      width: null,
      height: null,
      alt: "Alt",
      caption: null,
      variants: [],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    fetchMock.mockResolvedValue(jsonResponse(media));
    const file = new File(["bytes"], "a.png", { type: "image/png" });
    const uploaded = await runClient(uploadMedia(file, "Alt"));
    expect(uploaded.id).toBe("media-1");
    const { init } = lastCall();
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("alt")).toBe("Alt");
    expect((form.get("file") as File).name).toBe("a.png");
  });

  it("maps error statuses through", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: "Unauthorized" }, 401));
    const error = await runClient(listPosts(1).pipe(Effect.flip));
    expect(error.status).toBe(401);
  });

  it("builds public file URLs", () => {
    expect(mediaFileUrl("http://localhost:8788", "m1")).toBe(
      "http://localhost:8788/content/media/m1/file",
    );
  });
});

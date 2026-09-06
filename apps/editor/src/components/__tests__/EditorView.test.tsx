import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "../EditorView";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jsonResponse = <B,>(body: B, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const post = {
  id: "post-1",
  slug: "hello-world",
  title: "Hello World",
  summary: null,
  content: doc,
  html: "<p>Hello</p>",
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  categories: [{ id: "cat-1", slug: "essays", title: "Essays" }],
  meta: { title: null, description: null, image: null },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const categories = [
  { id: "cat-1", slug: "essays", title: "Essays" },
  { id: "cat-2", slug: "notes", title: "Notes" },
];

const saveBody = (index: number): { slug?: unknown; title?: unknown; categoryIds?: unknown } => {
  const [, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return JSON.parse(String(init.body)) as {
    slug?: unknown;
    title?: unknown;
    categoryIds?: unknown;
  };
};

describe("EditorView", () => {
  describe("new post", () => {
    // Tiptap cold start takes seconds on loaded CI runners — allow extra time.
    it("creates a post from the form", { timeout: 30_000 }, async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(jsonResponse(post));
      const onExit = vi.fn();
      const { findByLabelText, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={onExit} />
      ));
      fireEvent.input(await findByLabelText("Title"), { target: { value: "Hello World" } });
      fireEvent.click(await findByRole("button", { name: "Use title" }));
      expect(((await findByLabelText("Slug")) as HTMLInputElement).value).toBe("hello-world");
      fireEvent.click(await findByRole("button", { name: "Create" }));
      await findByText("Saved");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [saveUrl, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(saveUrl).toBe("http://localhost:8788/content/posts");
      expect(saveInit.method).toBe("POST");
      expect(saveBody(1).slug).toBe("hello-world");
    });

    it("saves a fresh code block with a default language", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(jsonResponse(post));
      const { findByLabelText, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      fireEvent.input(await findByLabelText("Title"), { target: { value: "Hello World" } });
      fireEvent.click(await findByRole("button", { name: "Use title" }));
      fireEvent.click(await findByRole("button", { name: "</>" }));
      expect(await findByLabelText("Language")).toBeInTheDocument();
      fireEvent.click(await findByRole("button", { name: "Create" }));
      await findByText("Saved");
      expect(JSON.stringify(saveBody(1))).toContain(`"language":"text"`);
    });

    it("rejects an empty slug before any save call", async () => {
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const { findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      fireEvent.click(await findByRole("button", { name: "Create" }));
      expect(await findByText("Invalid post data")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing post", () => {
    it("loads fields and editor content, then updates", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(post))
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(jsonResponse({ ...post, title: "Hello Again" }));
      const { container, findByLabelText, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug="hello-world" onExit={() => undefined} />
      ));
      expect(((await findByLabelText("Title")) as HTMLInputElement).value).toBe("Hello World");
      await vi.waitFor(() =>
        expect(container.querySelector(".tiptap")?.textContent).toContain("Hello"),
      );
      fireEvent.input(await findByLabelText("Title"), { target: { value: "Hello Again" } });
      fireEvent.click(await findByRole("button", { name: "Save" }));
      await findByText("Saved");
      const [saveUrl, saveInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(saveUrl).toBe("http://localhost:8788/content/posts/hello-world");
      expect(saveInit.method).toBe("PUT");
      expect(saveBody(2).title).toBe("Hello Again");
    });

    it("saves toggled categories", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(post))
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(jsonResponse(post));
      const { findByRole, findByLabelText } = render(() => (
        <EditorView kind="posts" slug="hello-world" onExit={() => undefined} />
      ));
      fireEvent.click(await findByLabelText("Notes"));
      fireEvent.click(await findByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      expect(saveBody(2).categoryIds).toEqual(["cat-1", "cat-2"]);
    });

    it("deletes after confirm and exits", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(post))
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(jsonResponse({ id: "post-1" }));
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const onExit = vi.fn();
      const { findByRole } = render(() => (
        <EditorView kind="posts" slug="hello-world" onExit={onExit} />
      ));
      fireEvent.click(await findByRole("button", { name: "Delete" }));
      await vi.waitFor(() => expect(onExit).toHaveBeenCalled());
      const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(deleteUrl).toBe("http://localhost:8788/content/posts/hello-world");
      expect(deleteInit.method).toBe("DELETE");
    });

    it("shows load errors with a way back", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ title: "Not found" }, 404));
      const onExit = vi.fn();
      const { findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug="nope" onExit={onExit} />
      ));
      expect(await findByText("Editor request failed: 404")).toBeInTheDocument();
      fireEvent.click(await findByRole("button", { name: "Back" }));
      expect(onExit).toHaveBeenCalled();
    });

    it("renders media nodes as live images in the editor", async () => {
      const mediaDoc = {
        type: "doc",
        content: [{ type: "cmsMedia", attrs: { mediaId: "media-1", alt: "Alt" } }],
      };
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ ...post, content: mediaDoc }))
        .mockResolvedValueOnce(jsonResponse(categories));
      const { container } = render(() => (
        <EditorView kind="posts" slug="hello-world" onExit={() => undefined} />
      ));
      await vi.waitFor(() =>
        expect(container.querySelector(".tiptap-editor figure img")).not.toBeNull(),
      );
      const image = container.querySelector(".tiptap-editor figure img") as HTMLImageElement | null;
      expect(image?.getAttribute("src")).toBe("http://localhost:8788/content/media/media-1/file");
      expect(image?.getAttribute("alt")).toBe("Alt");
    });
  });

  describe("insert panels", () => {
    it("uploads media and inserts the node", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(categories));
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
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          docs: [],
          totalDocs: 0,
          limit: 100,
          page: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      );
      fetchMock.mockResolvedValueOnce(jsonResponse(media));
      const { container, findByLabelText, findByRole } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await vi.waitFor(() => expect(container.querySelector(".tiptap")).not.toBeNull());
      fireEvent.click(await findByRole("button", { name: "Media" }));
      const picker = (await findByLabelText("File")) as HTMLInputElement;
      fireEvent.change(picker, {
        target: { files: [new File(["bytes"], "a.png", { type: "image/png" })] },
      });
      fireEvent.input(await findByLabelText("Alt text"), { target: { value: "Alt" } });
      fireEvent.click(await findByRole("button", { name: "Upload and insert" }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      const [uploadUrl, uploadInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(uploadUrl).toBe("http://localhost:8788/content/media");
      expect(uploadInit.body instanceof FormData).toBe(true);
    });

    it("picks existing media from the dialog", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(categories)).mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              id: "media-9",
              key: "media/media-9/picked.webp",
              mime: "image/webp",
              width: null,
              height: null,
              alt: "Picked",
              caption: null,
              variants: [],
              createdAt: "2026-09-01T00:00:00.000Z",
              updatedAt: "2026-09-01T00:00:00.000Z",
            },
          ],
          totalDocs: 1,
          limit: 100,
          page: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      );
      const { container, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await vi.waitFor(() => expect(container.querySelector(".tiptap")).not.toBeNull());
      fireEvent.click(await findByRole("button", { name: "Media" }));
      fireEvent.click(await findByText("picked.webp"));
      await vi.waitFor(() =>
        expect(container.querySelector(".tiptap-editor figure img")).not.toBeNull(),
      );
      const image = container.querySelector(".tiptap-editor figure img") as HTMLImageElement | null;
      expect(image?.getAttribute("src")).toBe("http://localhost:8788/content/media/media-9/file");
    });

    it("inserts arena refs from the dialog", async () => {
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const { container, findByLabelText, findByRole } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await vi.waitFor(() => expect(container.querySelector(".tiptap")).not.toBeNull());
      fireEvent.click(await findByRole("button", { name: "Arena" }));
      fireEvent.input(await findByLabelText("Channel slug"), { target: { value: "toms-place" } });
      fireEvent.click(await findByRole("button", { name: "Insert" }));
      fireEvent.click(await findByRole("button", { name: "Show preview" }));
      await vi.waitFor(() => {
        const preview = container.querySelector(".preview") as HTMLElement | null;
        expect(preview?.innerHTML).toContain(`data-arena="toms-place"`);
      });
    });

    it("rejects dangerous link targets", async () => {
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const { findByLabelText, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      fireEvent.click(await findByRole("button", { name: "Link" }));
      fireEvent.input(await findByLabelText("URL"), { target: { value: "javascript:alert(1)" } });
      fireEvent.click(await findByRole("button", { name: "Apply" }));
      expect(await findByText("Use an http(s), mailto, /, or # link")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

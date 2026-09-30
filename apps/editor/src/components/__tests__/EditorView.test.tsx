import { render } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorView } from "../EditorView";
import {
  fetchMock,
  jsonResponse,
  listBody,
  media,
  tiptapDoc,
  useFetchMock,
} from "../../test/helpers";

useFetchMock();

const doc = tiptapDoc("Hello");

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

describe("EditorView", { timeout: 30_000 }, () => {
  // Tiptap cold start plus chained async flushes take seconds on loaded
  // CI runners — allow extra time for every test in this file.
  describe("new post", () => {
    it("creates a post from the form", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(jsonResponse(post));
      const onExit = vi.fn();
      const { findByLabelText, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={onExit} />
      ));
      await userEvent.type(await findByLabelText("Title"), "Hello World");
      await userEvent.click(await findByRole("button", { name: "Use title" }));
      expect(((await findByLabelText("Slug")) as HTMLInputElement).value).toBe("hello-world");
      await userEvent.click(await findByRole("button", { name: "Create" }));
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
      await userEvent.type(await findByLabelText("Title"), "Hello World");
      await userEvent.click(await findByRole("button", { name: "Use title" }));
      await userEvent.click(await findByRole("button", { name: "</>" }));
      expect(await findByLabelText("Language")).toBeInTheDocument();
      await userEvent.click(await findByRole("button", { name: "Create" }));
      await findByText("Saved");
      expect(JSON.stringify(saveBody(1))).toContain(`"language":"text"`);
    });

    it("rejects an empty slug before any save call", async () => {
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const { findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await userEvent.click(await findByRole("button", { name: "Create" }));
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
      await userEvent.clear(await findByLabelText("Title"));
      await userEvent.type(await findByLabelText("Title"), "Hello Again");
      await userEvent.click(await findByRole("button", { name: "Save" }));
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
      await userEvent.click(await findByRole("button", { name: /Categories/ }));
      await userEvent.click(await findByLabelText("Notes"));
      await userEvent.click(await findByRole("button", { name: "Save" }));
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
      await userEvent.click(await findByRole("button", { name: "Delete" }));
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
      await userEvent.click(await findByRole("button", { name: "Back" }));
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
    it("opens the insert dialog and cancels without inserting", async () => {
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const { container, findByRole, queryByRole } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await vi.waitFor(() => expect(container.querySelector(".tiptap")).not.toBeNull());
      await userEvent.click(await findByRole("button", { name: "Arena" }));
      expect(await findByRole("dialog")).toBeInTheDocument();
      await userEvent.click(await findByRole("button", { name: "Cancel" }));
      await vi.waitFor(() => expect(queryByRole("dialog")).toBeNull());
      expect(container.querySelector(".tiptap-editor div[data-arena]")).toBeNull();
    });

    it("uploads media and inserts the node", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(categories));
      fetchMock.mockResolvedValueOnce(jsonResponse(listBody([])));
      fetchMock.mockResolvedValueOnce(
        jsonResponse(media("media-1", "a.png", { mime: "image/png" })),
      );
      const { container, findByLabelText, findByRole } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await vi.waitFor(() => expect(container.querySelector(".tiptap")).not.toBeNull());
      await userEvent.click(await findByRole("button", { name: "Media" }));
      const picker = (await findByLabelText("File")) as HTMLInputElement;
      await userEvent.upload(picker, new File(["bytes"], "a.png", { type: "image/png" }));
      await userEvent.type(await findByLabelText("Alt text"), "Alt");
      await userEvent.click(await findByRole("button", { name: "Upload and insert" }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      const [uploadUrl, uploadInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(uploadUrl).toBe("http://localhost:8788/content/media");
      expect(uploadInit.body instanceof FormData).toBe(true);
    });

    it("picks existing media from the dialog", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(categories))
        .mockResolvedValueOnce(
          jsonResponse(listBody([media("media-9", "picked.webp", { alt: "Picked" })])),
        );
      const { container, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await vi.waitFor(() => expect(container.querySelector(".tiptap")).not.toBeNull());
      await userEvent.click(await findByRole("button", { name: "Media" }));
      await userEvent.click(await findByText("picked.webp"));
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
      await userEvent.click(await findByRole("button", { name: "Arena" }));
      await userEvent.type(await findByLabelText("Channel slug"), "toms-place");
      await userEvent.click(await findByRole("button", { name: "Insert" }));
      await vi.waitFor(() => {
        const node = container.querySelector(
          '.tiptap-editor div[data-arena="toms-place"]',
        ) as HTMLElement | null;
        expect(node).not.toBeNull();
      });
    });

    it("rejects dangerous link targets", async () => {
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const { findByLabelText, findByRole, findByText } = render(() => (
        <EditorView kind="posts" slug={null} onExit={() => undefined} />
      ));
      await userEvent.click(await findByRole("button", { name: "Link" }));
      await userEvent.type(await findByLabelText("URL"), "javascript:alert(1)");
      await userEvent.click(await findByRole("button", { name: "Apply" }));
      expect(await findByText("Use an http(s), mailto, /, or # link")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

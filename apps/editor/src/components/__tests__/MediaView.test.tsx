import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentKind } from "../../lib/content";
import { MediaView } from "../MediaView";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
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

const media = (id: string, name: string, createdAt: string) => ({
  id,
  key: `media/${id}/${name}`,
  mime: "image/webp",
  width: null,
  height: null,
  alt: null,
  caption: null,
  variants: [],
  createdAt,
  updatedAt: createdAt,
});

const listBody = (docs: Array<unknown>) => ({
  docs,
  totalDocs: docs.length,
  limit: 100,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

const usageBody = {
  posts: [{ slug: "hello-world", title: "Hello World" }],
  works: [],
};

describe("MediaView", () => {
  it("lists newest first and filters by filename", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        listBody([
          media("media-1", "old.webp", "2026-09-01T00:00:00.000Z"),
          media("media-2", "new.webp", "2026-09-05T00:00:00.000Z"),
        ]),
      ),
    );
    const edits: Array<{ kind: ContentKind; slug: string }> = [];
    const { findByText, findByLabelText, queryByText } = render(() => (
      <MediaView onEdit={(kind, slug) => edits.push({ kind, slug })} />
    ));
    await findByText("old.webp");
    await findByText("new.webp");
    fireEvent.input(await findByLabelText("Search media"), { target: { value: "new" } });
    await vi.waitFor(() => expect(queryByText("old.webp")).toBeNull());
    expect(queryByText("new.webp")).not.toBeNull();
  });

  it("expands usage, opens the post, and deletes after confirm", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(listBody([media("media-1", "hero.webp", "2026-09-01T00:00:00.000Z")])),
      )
      .mockResolvedValueOnce(jsonResponse(usageBody))
      .mockResolvedValueOnce(jsonResponse({ id: "media-1" }));
    const edits: Array<{ kind: ContentKind; slug: string }> = [];
    const { findByText, findByRole, queryByText } = render(() => (
      <MediaView onEdit={(kind, slug) => edits.push({ kind, slug })} />
    ));
    await findByText("hero.webp");
    fireEvent.click(await findByRole("button", { name: "Usage" }));
    await findByText("Post: Hello World");
    fireEvent.click(await findByRole("button", { name: "Post: Hello World" }));
    expect(edits).toEqual([{ kind: "posts", slug: "hello-world" }]);
    fireEvent.click(await findByRole("button", { name: "Delete" }));
    await vi.waitFor(() => expect(queryByText("hero.webp")).toBeNull());
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(deleteUrl).toBe("http://localhost:8788/content/media/media-1");
    expect(deleteInit.method).toBe("DELETE");
  });

  it("shows an empty state without media", async () => {
    fetchMock.mockResolvedValue(jsonResponse(listBody([])));
    const { findByText } = render(() => <MediaView onEdit={() => undefined} />);
    await findByText("No media yet — upload from a post or work.");
  });
});

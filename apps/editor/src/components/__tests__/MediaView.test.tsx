import { fireEvent, render } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentKind } from "../../lib/content";
import { MediaView } from "../MediaView";
import { fetchMock, jsonResponse, listBody, media, useFetchMock } from "../../test/helpers";

useFetchMock();

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
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
          media("media-1", "old.webp", { alt: null }),
          media("media-2", "new.webp", {
            alt: null,
            createdAt: "2026-09-05T00:00:00.000Z",
          }),
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
      .mockResolvedValueOnce(jsonResponse(listBody([media("media-1", "hero.webp", { alt: null })])))
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

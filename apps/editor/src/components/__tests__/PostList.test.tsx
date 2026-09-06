import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostList } from "../PostList";

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

const doc = { type: "doc", content: [] };

const post = (overrides = {}) => ({
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
  ...overrides,
});

const listBody = (docs: Array<unknown>) => ({
  docs,
  totalDocs: docs.length,
  limit: 50,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

describe("PostList", () => {
  it("lists posts and opens the editor on row click", async () => {
    fetchMock.mockResolvedValue(jsonResponse(listBody([post()])));
    const edits: Array<{ kind: string; slug: string | null }> = [];
    const { findByText } = render(() => (
      <PostList onEdit={(kind, slug) => edits.push({ kind, slug })} />
    ));
    const row = await findByText("Hello World");
    expect(row.textContent ?? "").toContain("Hello World");
    fireEvent.click(row.closest("button") ?? row);
    expect(edits).toEqual([{ kind: "posts", slug: "hello-world" }]);
  });

  it("starts a new post", async () => {
    fetchMock.mockResolvedValue(jsonResponse(listBody([])));
    const edits: Array<{ kind: string; slug: string | null }> = [];
    const { findByRole } = render(() => (
      <PostList onEdit={(kind, slug) => edits.push({ kind, slug })} />
    ));
    fireEvent.click(await findByRole("button", { name: "New" }));
    expect(edits).toEqual([{ kind: "posts", slug: null }]);
  });

  it("switches to works", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(listBody([post()])))
      .mockResolvedValueOnce(jsonResponse(listBody([])));
    const { findByRole, findByText } = render(() => <PostList onEdit={() => undefined} />);
    await findByText("Hello World");
    fireEvent.click(await findByRole("button", { name: "Works" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [worksUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(worksUrl).toBe("http://localhost:8788/content/works?status=all&pageSize=50");
    expect(await findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("deletes a row after confirm and reloads", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(listBody([post()])))
      .mockResolvedValueOnce(jsonResponse({ id: "post-1" }))
      .mockResolvedValueOnce(jsonResponse(listBody([])));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { findByRole } = render(() => <PostList onEdit={() => undefined} />);
    fireEvent.click(await findByRole("button", { name: "Delete hello-world" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(deleteInit.method).toBe("DELETE");
  });

  it("shows load errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: "Down" }, 500));
    const { findByText } = render(() => <PostList onEdit={() => undefined} />);
    expect(await findByText("Editor request failed: 500")).toBeInTheDocument();
  });
});

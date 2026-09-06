import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsPost, CmsWork } from "@tom/schemas/cms";
import { HistoryPanel } from "../HistoryPanel";

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

const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
};

const metas = [
  { id: "rev-2", createdAt: "2026-09-05T10:00:00.000Z", actor: "gh@tomhackshaw.com", title: "V2" },
  { id: "rev-1", createdAt: "2026-09-05T09:00:00.000Z", actor: "gh@tomhackshaw.com", title: "V1" },
];

const snapshot = {
  slug: "hello-world",
  title: "V1",
  summary: null,
  content: doc,
  status: "draft",
  publishedAt: null,
  heroMediaId: null,
  categoryIds: [],
  meta: { title: null, description: null, image: null },
};

const restored = {
  ...snapshot,
  id: "post-1",
  html: "<p>Hi</p>",
  categories: [],
  createdAt: "2026-09-05T09:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
};

describe("HistoryPanel", () => {
  const panelProps = (overrides: { onRestored?: (item: CmsPost | CmsWork) => void } = {}) => ({
    kind: "posts" as const,
    slug: "hello-world",
    onRestored: overrides.onRestored ?? (() => undefined),
    onReload: () => undefined,
  });

  it("lists revisions newest first and restores the selected snapshot", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(metas))
      .mockResolvedValueOnce(jsonResponse(snapshot))
      .mockResolvedValueOnce(jsonResponse(restored))
      .mockResolvedValueOnce(jsonResponse(metas));
    const saved: Array<CmsPost | CmsWork> = [];
    const { findByText, getByText } = render(() => (
      <HistoryPanel {...panelProps({ onRestored: (item) => saved.push(item) })} />
    ));
    await findByText("V2");
    fireEvent.click(getByText("V1"));
    const restore = await findByText("Restore this version");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(restore);
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.title).toBe("V1");
    const restoreCall = fetchMock.mock.calls[2];
    expect(restoreCall?.[0]).toContain("/content/posts/hello-world/restore");
  });

  it("refreshes the list through the registered reload", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([metas[1]]))
      .mockResolvedValueOnce(jsonResponse(metas));
    const reloads: Array<() => void> = [];
    const { findByText } = render(() => (
      <HistoryPanel {...panelProps({})} onReload={(reload) => reloads.push(reload)} />
    ));
    await findByText("V1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    reloads[0]?.();
    await findByText("V2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows an empty state before the first save", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const { findByText } = render(() => <HistoryPanel {...panelProps({})} />);
    await findByText("No revisions yet — save to create one.");
  });
});

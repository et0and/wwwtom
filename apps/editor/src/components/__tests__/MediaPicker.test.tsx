import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPicker } from "../MediaPicker";

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

const media = (id: string, name: string) => ({
  id,
  key: `media/${id}/${name}`,
  mime: "image/webp",
  width: null,
  height: null,
  alt: "Alt",
  caption: null,
  variants: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
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

describe("MediaPicker", () => {
  it("lists assets, filters by filename, and picks on click", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(listBody([media("media-1", "old.webp"), media("media-2", "new.webp")])),
    );
    const picked: Array<{ readonly id: string }> = [];
    const { findByText, findByLabelText, queryByText } = render(() => (
      <MediaPicker onPick={(item) => picked.push(item)} />
    ));
    await findByText("old.webp");
    await findByText("new.webp");
    fireEvent.input(await findByLabelText("Choose existing"), { target: { value: "new" } });
    await vi.waitFor(() => expect(queryByText("old.webp")).toBeNull());
    fireEvent.click(await findByText("new.webp"));
    expect(picked.map((item) => item.id)).toEqual(["media-2"]);
  });

  it("shows an empty state without matches", async () => {
    fetchMock.mockResolvedValue(jsonResponse(listBody([])));
    const { findByText } = render(() => <MediaPicker onPick={() => undefined} />);
    await findByText("No matching media.");
  });
});

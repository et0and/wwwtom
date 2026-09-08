import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { jsonResponse, requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();

const mockArenaBody = <T>(body: T): void => {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(body)));
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const env = testEnv();

const publicChannel = {
  id: 1001,
  type: "Channel",
  slug: "philemon",
  title: "Philemon",
  description: null,
  state: "available",
  visibility: "public",
  created_at: "2021-01-01T00:00:00.000Z",
  updated_at: "2023-06-01T00:00:00.000Z",
  metadata: null,
  owner: null,
  counts: { blocks: 0, channels: 0, contents: 0, collaborators: 0 },
  collaborators: [],
};

const contentsBody = {
  data: [],
  meta: {
    current_page: 1,
    next_page: null,
    prev_page: null,
    per_page: 100,
    total_pages: 0,
    total_count: 0,
    has_more_pages: false,
  },
};

describe("arena public cache", () => {
  it("marks channel contents responses cacheable", async () => {
    mockArenaBody(contentsBody);
    const response = await app.fetch(
      requestWithEnv("http://localhost/arena/channels/philemon/contents?per=100", env),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=600");
  });

  it("marks channel responses cacheable", async () => {
    mockArenaBody(publicChannel);
    const response = await app.fetch(
      requestWithEnv("http://localhost/arena/channels/philemon", env),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=600");
  });

  it("hides private channels behind not found", async () => {
    mockArenaBody({ ...publicChannel, visibility: "private" });
    const response = await app.fetch(requestWithEnv("http://localhost/arena/channels/secret", env));
    expect(response.status).toBe(404);
  });

  it("strips private items from channel contents", async () => {
    mockArenaBody({
      ...contentsBody,
      data: [
        { id: 1, type: "Text", visibility: "public" },
        { id: 2, type: "Text", visibility: "private" },
        { id: 3, type: "Channel", visibility: "closed" },
        { id: 4, type: "Channel", visibility: "private" },
      ],
    });
    const response = await app.fetch(
      requestWithEnv("http://localhost/arena/channels/philemon/contents?per=100", env),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.map((item: { id: number }) => item.id)).toEqual([1, 3]);
  });
});

import { afterEach, beforeEach, vi } from "vitest";
import type { TiptapDoc } from "@tom/schemas/cms";

export const fetchMock = vi.fn();

export const useFetchMock = (): void => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
};

export const jsonResponse = <B>(body: B, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const listBody = (docs: Array<unknown>) => ({
  docs,
  totalDocs: docs.length,
  limit: 100,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

type MediaOptions = {
  readonly alt?: string | null;
  readonly mime?: string;
  readonly createdAt?: string;
};

export const media = (id: string, name: string, options: MediaOptions = {}) => {
  const createdAt = options.createdAt ?? "2026-09-01T00:00:00.000Z";
  return {
    id,
    key: `media/${id}/${name}`,
    mime: options.mime ?? "image/webp",
    width: null,
    height: null,
    alt: options.alt === undefined ? "Alt" : options.alt,
    caption: null,
    variants: [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const sessionBody = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "gh@tomhackshaw.com" },
};

export const tiptapDoc = (text: string): TiptapDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

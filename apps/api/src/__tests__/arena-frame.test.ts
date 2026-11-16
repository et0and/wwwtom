import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudflareEnv } from "@tom/utils/config";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { app } from "../index";
import { jsonResponse, requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();
const stubFetch = (): void => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
};
const unstubFetch = (): void => {
  vi.unstubAllGlobals();
};

/** Internal are.na reads: the token header is the adapter's, not the browser's. */
const arenaRequest = (url: string, env: CloudflareEnv, init: RequestInit = {}): Request =>
  requestWithEnv(url, env, {
    ...init,
    headers: { [INTERNAL_TOKEN_HEADER]: "test-internal-token", ...init.headers },
  });

beforeEach(stubFetch);

afterEach(unstubFetch);

const tomEnv = testEnv({ TENANT: "tom", ADAPTER_URL: "http://localhost" });
const sophieEnv = testEnv({ TENANT: "sophie" });

const CHANNEL = "tom-s-worktable";
const CDN_HOST = "https://d2w9rnfcy7mm78.cloudfront.net";

const markdown = (text: string) => ({ markdown: text, html: `<p>${text}</p>`, plain: text });

const contentsEnvelope = (data: ReadonlyArray<unknown>, hasMore = false, currentPage = 1) => ({
  meta: {
    current_page: currentPage,
    per_page: 20,
    total_pages: hasMore ? 2 : 1,
    total_count: data.length,
    has_more_pages: hasMore,
  },
  data,
});

const requestedUrlFor = (fragment: string): string => {
  const found = fetchMock.mock.calls
    .map((call) => {
      const [input] = call as [RequestInfo, RequestInit | undefined];
      return input instanceof Request ? input.url : String(input);
    })
    .find((url) => url.includes(fragment));
  if (found === undefined) throw new Error(`No request matched ${fragment}`);
  return found;
};

const imageBlock = (id: number, title: string, src = `${CDN_HOST}/medium.jpg`) => ({
  id,
  type: "Image",
  title,
  image: {
    src: `${CDN_HOST}/original.jpg`,
    medium: { src, width: 768, height: 1024 },
    large: { src: `${CDN_HOST}/large.jpg`, width: 2048, height: 2731 },
  },
});

const textBlock = (id: number, text: string) => ({ id, type: "Text", content: markdown(text) });

type StubRoute = readonly [path: string, body: unknown];

/**
 * Match are.na calls by pathname. Image requests hit a different host, so the
 * frame endpoint can be exercised with a real two-hop fetch.
 */
const stubArena = (
  routes: ReadonlyArray<StubRoute>,
  imageBytes?: Uint8Array<ArrayBuffer>,
): void => {
  fetchMock.mockImplementation(async (input: RequestInfo) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const match = routes.find(([path]) => url.pathname === path);
    if (match !== undefined) return jsonResponse(match[1]);
    if (imageBytes !== undefined && url.origin === CDN_HOST) {
      return new Response(imageBytes, { headers: { "Content-Type": "image/jpeg" } });
    }
    return jsonResponse({ message: "Not found" }, 404);
  });
};

describe("are.na frame integration", () => {
  describe("GET /arena/frame/:slug", () => {
    it("lists only image-bearing blocks, with absolute frame URLs", async () => {
      stubArena([
        [
          `/v3/channels/${CHANNEL}/contents`,
          contentsEnvelope([imageBlock(12, "Second"), textBlock(11, "A note")]),
        ],
      ]);

      const response = await app.fetch(
        arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}`, tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        channel: CHANNEL,
        page: 1,
        hasMore: false,
        width: 240,
        height: 135,
        format: "rgb565be",
      });
      expect(body.blocks).toHaveLength(1);
      expect(body.blocks[0]).toMatchObject({
        id: 12,
        title: "Second",
        imageUrl: `http://localhost/arena/frame/${CHANNEL}/image/12`,
      });
      expect(response.headers.get("Cache-Control")).toContain("public");
    });

    it("asks are.na for one page in position order", async () => {
      stubArena([[`/v3/channels/${CHANNEL}/contents`, contentsEnvelope([])]]);

      await app.fetch(arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}`, tomEnv));

      const contentsUrl = new URL(requestedUrlFor(`${CHANNEL}/contents`));
      expect(contentsUrl.searchParams.get("sort")).toBe("position_desc");
      expect(contentsUrl.searchParams.get("per")).toBe("20");
      expect(contentsUrl.searchParams.get("page")).toBe("1");
      expect(contentsUrl.searchParams.has("date")).toBe(false);
    });

    it("forwards the per-boot token as an are.na cache-bust", async () => {
      stubArena([[`/v3/channels/${CHANNEL}/contents`, contentsEnvelope([])]]);

      await app.fetch(
        arenaRequest(
          `http://localhost/internal/arena/frame/${CHANNEL}?page=1&t=1735607571`,
          tomEnv,
        ),
      );

      const contentsUrl = new URL(requestedUrlFor(`${CHANNEL}/contents`));
      expect(contentsUrl.searchParams.get("date")).toBe("1735607571");
    });

    it("serves the requested page and reports whether another follows", async () => {
      stubArena([
        [`/v3/channels/${CHANNEL}/contents`, contentsEnvelope([imageBlock(9, "Older")], true, 2)],
      ]);

      const response = await app.fetch(
        arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}?page=2`, tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ page: 2, hasMore: true });
      const contentsUrl = new URL(requestedUrlFor(`${CHANNEL}/contents`));
      expect(contentsUrl.searchParams.get("page")).toBe("2");
      expect(contentsUrl.searchParams.get("per")).toBe("20");
    });

    it("hides the frame from the Sophie tenant", async () => {
      const response = await app.fetch(
        arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}`, sophieEnv),
      );

      expect(response.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("GET /arena/frame/:slug/image/:id", () => {
    it("renders one block as a 240x135 RGB565 frame", async () => {
      stubArena(
        [["/v3/blocks/12", imageBlock(12, "Second", `${CDN_HOST}/medium.jpg`)]],
        new Uint8Array([1, 2, 3]),
      );

      const response = await app.fetch(
        arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}/image/12`, tomEnv),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
      expect(response.headers.get("X-Frame-Width")).toBe("240");
      expect(response.headers.get("X-Frame-Height")).toBe("135");
      expect(response.headers.get("X-Frame-Format")).toBe("rgb565be");
      expect(response.headers.get("Cache-Control")).toContain("s-maxage=604800");

      const frame = new Uint8Array(await response.arrayBuffer());
      expect(frame).toHaveLength(240 * 135 * 2);
      // The stub decodes every image to solid red: 0xF800, high byte first.
      expect(Array.from(frame.slice(0, 2))).toEqual([0xf8, 0x00]);
      expect(Array.from(frame.slice(-2))).toEqual([0xf8, 0x00]);
    });

    it("rejects a block without an image", async () => {
      stubArena([["/v3/blocks/11", textBlock(11, "A note")]]);

      const response = await app.fetch(
        arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}/image/11`, tomEnv),
      );

      expect(response.status).toBe(404);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("refuses to fetch an image from a host that is not are.na", async () => {
      stubArena([["/v3/blocks/12", imageBlock(12, "Second", "https://evil.example/medium.jpg")]]);

      const response = await app.fetch(
        arenaRequest(`http://localhost/internal/arena/frame/${CHANNEL}/image/12`, tomEnv),
      );

      expect(response.status).toBe(422);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

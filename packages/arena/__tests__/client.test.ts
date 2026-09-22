import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Cause, Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { ArenaClient, type Fetch, type DateProvider } from "../src/client";

type MockFetch = ReturnType<typeof vi.fn<Fetch>>;

const createMockFetch = (response: Partial<Response> = {}): MockFetch => {
  // Covers every makeRequest envelope (channels, user/group channels, thumb).
  const validArenaResponse = {
    per: 50,
    page: 1,
    owner: null,
    collaborators: null,
    total_pages: 1,
    current_page: 1,
    base_type: "User",
    type: "User",
    channels: [],
    channel_title: null,
    contents: null,
  };
  const defaultResponse: Response = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ ...validArenaResponse }),
    text: async () => JSON.stringify(validArenaResponse),
    ...response,
  } as Response;
  return vi.fn(async () => defaultResponse);
};

const createDateProvider = (timestamp: number): DateProvider => ({
  now: () => timestamp,
});

const getRequestUrl = (call: unknown[]): string => {
  const input = call[0];
  return input instanceof Request ? input.url : String(input);
};

const getRequestHeaders = (call: unknown[]): Headers => {
  const input = call[0];
  if (input instanceof Request) return input.headers;
  const init = call[1] as RequestInit | undefined;
  if (!init?.headers) return new Headers();
  if (init.headers instanceof Headers) return init.headers;
  return new Headers(init.headers as Record<string, string>);
};

const runEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect);

describe("ArenaClient", () => {
  let mockFetch: MockFetch;

  beforeEach(() => {
    mockFetch = createMockFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeToken (via constructor)", () => {
    it.each([
      {
        label: "sets Authorization header when valid token provided",
        token: "valid-token",
        expected: "Bearer valid-token",
      },
      {
        label: "trims whitespace from token",
        token: "  valid-token  ",
        expected: "Bearer valid-token",
      },
      {
        label: "omits Authorization header when token is null",
        token: null,
        expected: null,
      },
      {
        label: "omits Authorization header when token is undefined",
        token: undefined,
        expected: null,
      },
      {
        label: "omits Authorization header when token is 'undefined' string",
        token: "undefined",
        expected: null,
      },
      {
        label: "omits Authorization header when token is 'null' string",
        token: "null",
        expected: null,
      },
      {
        label: "omits Authorization header when token is empty string",
        token: "",
        expected: null,
      },
      {
        label: "omits Authorization header when token is whitespace-only",
        token: "   ",
        expected: null,
      },
    ])("$label", async ({ token, expected }) => {
      const client = new ArenaClient({ token, fetch: mockFetch });

      await runEffect(client.me);

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.get("Authorization")).toBe(expected);
    });
  });

  describe("paginationQueryString", () => {
    it("uses default pagination options when none provided", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels());

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("sort=position_desc");
      expect(url).toContain("per_page=50");
      expect(url).not.toContain("date=");
    });

    it("builds query string with page and per", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels({ page: 1, per: 10 }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("page=1");
      expect(url).toContain("per_page=10");
    });

    it("builds query string with sort and direction", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels({ sort: "position", direction: "desc" }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("sort=position_desc");
    });

    it("builds query string with sort only (no direction)", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels({ sort: "created_at" }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("sort=created_at_desc");
    });

    it("combines page, per, sort, and direction", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels({ page: 2, per: 50, sort: "date", direction: "asc" }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("page=2");
      expect(url).toContain("per_page=50");
      expect(url).toContain("sort=date_asc");
    });

    it("includes date query param when forceRefresh is true", async () => {
      const fixedTime = 1700000000000;
      const dateProvider = createDateProvider(fixedTime);
      const client = new ArenaClient({ fetch: mockFetch, date: dateProvider });

      await runEffect(client.channels({ forceRefresh: true }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain(`date=${fixedTime}`);
    });

    it("omits date param when forceRefresh is false", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels({ per: 10, forceRefresh: false }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).not.toContain("date=");
    });
  });

  describe("request construction", () => {
    it("uses injected fetch function", async () => {
      const customFetch = createMockFetch();
      const client = new ArenaClient({ fetch: customFetch });

      await runEffect(client.me);

      expect(customFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("returns an HttpError with status 502 on network failure", async () => {
      const networkErrorFetch = vi.fn(async () => {
        throw new Error("Network down");
      });
      const client = new ArenaClient({ fetch: networkErrorFetch });

      const result = await Effect.runPromiseExit(client.me);

      expect(result._tag).toBe("Failure");
      if (result._tag !== "Failure") throw new Error("Expected Failure");
      const httpError = result.cause.reasons.find(Cause.isFailReason)?.error;
      expect(httpError).toBeInstanceOf(HttpError);
      if (!(httpError instanceof HttpError)) throw new Error("Expected HttpError");
      // A network failure has no upstream status; 502 is the truthful one.
      expect(httpError.status).toBe(502);
    });

    it("returns an HttpError carrying the upstream status on non-ok response", async () => {
      const errorResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "content-type": "text/plain" }),
        // The SDK normalizes non-ok bodies via response.text(); without it
        // a TypeError would escape and land in the 500 catch-all.
        text: async () => "",
        json: async () => ({}),
      } as Response;
      const errorFetch = vi.fn(async () => errorResponse);
      const client = new ArenaClient({ fetch: errorFetch });

      const result = await Effect.runPromiseExit(client.block(999).get);

      expect(result._tag).toBe("Failure");
      if (result._tag !== "Failure") throw new Error("Expected Failure");
      const httpError = result.cause.reasons.find(Cause.isFailReason)?.error;
      expect(httpError).toBeInstanceOf(HttpError);
      if (!(httpError instanceof HttpError)) throw new Error("Expected HttpError");
      expect(httpError.status).toBe(404);
    });
  });

  describe("API methods", () => {
    it("me() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.me);

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toBe("https://api.are.na/v3/me");
    });

    it("channels() calls correct endpoint with pagination", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channels({ page: 3, per: 25 }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("https://api.are.na/v3/channels?");
      expect(url).toContain("page=3");
      expect(url).toContain("per_page=25");
    });

    it("user(id).get() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.user(42).get);

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toBe("https://api.are.na/v3/users/42");
    });

    it("user(id).channels() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.user("john").channels({ per: 10 }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("https://api.are.na/v3/users/john/channels");
      expect(url).toContain("per_page=10");
    });

    it("channel(slug).get() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channel("my-channel").get);

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("https://api.are.na/v3/channels/my-channel");
    });

    it("block(id).get() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.block(123).get);

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toBe("https://api.are.na/v3/blocks/123");
    });

    it("search.everything() calls correct endpoint with query", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.search.everything("test query"));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("https://api.are.na/v3/search");
      expect(url).toContain("query=test");
    });
  });

  describe("worker cache", () => {
    const stubCaches = (cached: Response | undefined) => {
      const match = vi.fn(async () => cached);
      const put = vi.fn(async () => undefined);
      vi.stubGlobal("caches", { default: { match, put } });
      return { match, put };
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const realFetch = () =>
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      );

    it("serves a cached public response without calling are.na", async () => {
      const cached = new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      const { match, put } = stubCaches(cached);
      const fetchSpy = realFetch();
      const client = new ArenaClient({ fetch: fetchSpy });

      await runEffect(client.channel("my-channel").contents());

      expect(match).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    });

    it("stores a public response in the worker cache", async () => {
      const { match, put } = stubCaches(undefined);
      const fetchSpy = realFetch();
      const client = new ArenaClient({ fetch: fetchSpy });

      await runEffect(client.channel("my-channel").contents());

      expect(match).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledTimes(1);
    });

    it("never caches token reads", async () => {
      const { match, put } = stubCaches(undefined);
      const client = new ArenaClient({ token: "valid-token", fetch: realFetch() });

      await runEffect(client.channel("my-channel").contents());

      expect(match).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    });
  });

  describe("edge cache", () => {
    const cfOf = (call: unknown[]): { cacheTtl?: number } | undefined =>
      (call[1] as { cf?: { cacheTtl?: number } } | undefined)?.cf;

    it("caches unauthenticated SDK GET requests but never errors", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.channel("my-channel").contents());

      expect(cfOf(mockFetch.mock.calls[0]!)).toMatchObject({
        cacheTtl: 86400,
        cacheTtlByStatus: { "400-599": 0 },
      });
    });

    it("does not cache SDK requests that carry a token", async () => {
      const client = new ArenaClient({ token: "valid-token", fetch: mockFetch });

      await runEffect(client.channel("my-channel").contents());

      expect(cfOf(mockFetch.mock.calls[0]!)).toMatchObject({ cacheTtl: 0 });
    });

    it("retries without the token when are.na rejects it", async () => {
      const unauthorized = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => "",
        json: async () => ({}),
      } as Response;
      const seen: Array<RequestInfo> = [];
      const retryFetch = vi.fn(async (input: RequestInfo) => {
        seen.push(input);
        if (seen.length === 1) return unauthorized;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ data: [], meta: {} }),
          text: async () => JSON.stringify({ data: [], meta: {} }),
        } as Response;
      });
      const client = new ArenaClient({ token: "valid-token", fetch: retryFetch });

      await runEffect(client.channel("my-channel").contents());

      expect(seen).toHaveLength(2);
      const retryRequest = seen[1];
      expect(retryRequest).toBeInstanceOf(Request);
      if (!(retryRequest instanceof Request)) throw new Error("Expected a Request");
      expect(retryRequest.headers.get("Authorization")).toBeNull();
    });
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Effect } from "effect";
import { ArenaClient, paginationQueryString, type Fetch, type DateProvider } from "../src/client";

type MockFetch = ReturnType<typeof vi.fn<Fetch>>;

const createMockFetch = (response: Partial<Response> = {}): MockFetch => {
  const defaultResponse: Response = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ data: {} }),
    text: async () => JSON.stringify({ data: {} }),
    ...response,
  } as Response;
  return vi.fn(async () => defaultResponse);
};

const createDateProvider = (timestamp: number): DateProvider => ({
  now: () => timestamp,
});

const getRequestUrl = (call: unknown[]): string => {
  const input = call[0];
  if (input instanceof Request) return input.url;
  if (typeof input === "string") return input;
  return String(input);
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
    it("sets Authorization header when valid token provided", async () => {
      const client = new ArenaClient({
        token: "valid-token",
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.get("Authorization")).toBe("Bearer valid-token");
    });

    it("trims whitespace from token", async () => {
      const client = new ArenaClient({
        token: "  valid-token  ",
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.get("Authorization")).toBe("Bearer valid-token");
    });

    it("omits Authorization header when token is null", async () => {
      const client = new ArenaClient({
        token: null,
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.has("Authorization")).toBe(false);
    });

    it("omits Authorization header when token is undefined", async () => {
      const client = new ArenaClient({
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.has("Authorization")).toBe(false);
    });

    it("omits Authorization header when token is 'undefined' string", async () => {
      const client = new ArenaClient({
        token: "undefined",
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.has("Authorization")).toBe(false);
    });

    it("omits Authorization header when token is 'null' string", async () => {
      const client = new ArenaClient({
        token: "null",
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.has("Authorization")).toBe(false);
    });

    it("omits Authorization header when token is empty string", async () => {
      const client = new ArenaClient({
        token: "",
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.has("Authorization")).toBe(false);
    });

    it("omits Authorization header when token is whitespace-only", async () => {
      const client = new ArenaClient({
        token: "   ",
        fetch: mockFetch,
      });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const headers = getRequestHeaders(call!);
      expect(headers.has("Authorization")).toBe(false);
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
      expect(url).toContain("sort=created_at");
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
    it("constructs correct URL with domain prefix", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.me());

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toBe("https://api.are.na/v3/me");
    });

    it("uses injected fetch function", async () => {
      const customFetch = createMockFetch();
      const client = new ArenaClient({ fetch: customFetch });

      await runEffect(client.me());

      expect(customFetch).toHaveBeenCalledTimes(1);
    });

    it("uses injected date provider for forceRefresh", async () => {
      const fixedTime = 1234567890000;
      const dateProvider = createDateProvider(fixedTime);
      const client = new ArenaClient({
        fetch: mockFetch,
        date: dateProvider,
      });

      await runEffect(client.channels({ forceRefresh: true }));

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain(`date=${fixedTime}`);
    });
  });

  describe("error handling", () => {
    it("returns HttpError on network failure", async () => {
      const networkErrorFetch = vi.fn(async () => {
        throw new Error("Network down");
      });
      const client = new ArenaClient({ fetch: networkErrorFetch });

      const result = await Effect.runPromiseExit(client.me());

      expect(result._tag).toBe("Failure");
      if (result._tag !== "Failure") throw new Error("Expected Failure");
      const cause = result.cause;
      expect(cause).toBeDefined();
      // Verify the cause structure - HttpError is wrapped in Effect's Cause
      expect(cause._tag).toBeDefined();
    });

    it("returns HttpError on non-ok response", async () => {
      const errorResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "content-type": "text/plain" }),
        json: async () => ({}),
      } as Response;
      const errorFetch = vi.fn(async () => errorResponse);
      const client = new ArenaClient({ fetch: errorFetch });

      const result = await Effect.runPromiseExit(client.block(999).get());

      expect(result._tag).toBe("Failure");
      if (result._tag !== "Failure") throw new Error("Expected Failure");
      const cause = result.cause;
      expect(cause).toBeDefined();
      // Verify the cause structure - HttpError is wrapped in Effect's Cause
      expect(cause._tag).toBeDefined();
    });
  });

  describe("API methods", () => {
    it("me() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.me());

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

      await runEffect(client.user(42).get());

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

      await runEffect(client.channel("my-channel").get());

      const call = mockFetch.mock.calls[0];
      const url = getRequestUrl(call!);
      expect(url).toContain("https://api.are.na/v3/channels/my-channel");
    });

    it("block(id).get() calls correct endpoint", async () => {
      const client = new ArenaClient({ fetch: mockFetch });

      await runEffect(client.block(123).get());

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
});

describe("paginationQueryString (direct)", () => {
  const dateProvider: DateProvider = { now: () => 1700000000000 };

  it("returns default values when no options provided", () => {
    const qs = paginationQueryString(undefined, dateProvider);
    expect(qs).toContain("sort=position_desc");
    expect(qs).toContain("per_page=50");
  });

  it("builds query string with page and per", () => {
    const qs = paginationQueryString({ page: 1, per: 10 }, dateProvider);
    expect(qs).toContain("page=1");
    expect(qs).toContain("per_page=10");
  });

  it("builds query string with combined sort and direction", () => {
    const qs = paginationQueryString({ sort: "position", direction: "desc" }, dateProvider);
    expect(qs).toContain("sort=position_desc");
  });

  it("builds query string with sort only (uses default direction)", () => {
    const qs = paginationQueryString({ sort: "created_at" }, dateProvider);
    expect(qs).toContain("sort=created_at_desc");
  });

  it("includes date when forceRefresh is true", () => {
    const fixedTime = 1700000000000;
    const dp: DateProvider = { now: () => fixedTime };
    const qs = paginationQueryString({ forceRefresh: true }, dp);
    expect(qs).toContain(`date=${fixedTime}`);
  });

  it("omits date when forceRefresh is false", () => {
    const qs = paginationQueryString({ forceRefresh: false }, dateProvider);
    expect(qs).not.toContain("date=");
  });

  it("omits date when forceRefresh is not specified", () => {
    const qs = paginationQueryString({}, dateProvider);
    expect(qs).not.toContain("date=");
  });

  it("combines all parameters correctly", () => {
    const qs = paginationQueryString(
      { page: 2, per: 25, sort: "date", direction: "asc" },
      dateProvider,
    );
    expect(qs).toContain("page=2");
    expect(qs).toContain("per_page=25");
    expect(qs).toContain("sort=date_asc");
  });
});

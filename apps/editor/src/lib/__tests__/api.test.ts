import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { CmsPostInputSchema } from "@tom/schemas/cms";
import { adapterUrl, decodeResponse, requestJson, requestVoid, runClient } from "../api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = <B>(body: B, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("editor api client", () => {
  it("targets the local adapter by default", () => {
    expect(adapterUrl()).toBe("http://localhost:8788");
  });

  it("sends cookies and returns JSON bodies", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ session: null }));
    const json = await runClient(requestJson("/auth/get-session", {}, "load_session"));
    expect(json).toEqual({ session: null });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
  });

  it("maps error statuses to editor errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: "Unauthorized" }, 401));
    const result = await runClient(
      requestJson("/auth/get-session", {}, "load_session").pipe(Effect.flip),
    );
    expect(result.status).toBe(401);
  });

  it("decodes responses at the boundary", async () => {
    const valid = {
      slug: "hello-world",
      title: "Hello World",
      summary: null,
      content: { type: "doc", content: [] },
      status: "draft",
      publishedAt: null,
      heroMediaId: null,
      categoryIds: [],
      meta: { title: null, description: null, image: null },
    };
    const decoded = await runClient(decodeResponse(CmsPostInputSchema, valid, "save_post"));
    expect(decoded.slug).toBe("hello-world");
    const invalid = await runClient(
      decodeResponse(CmsPostInputSchema, { slug: 42 }, "save_post").pipe(Effect.flip),
    );
    expect(invalid.status).toBe(500);
  });

  it("posts void requests with cookies", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await runClient(requestVoid("/auth/sign-out", { method: "POST" }, "sign_out"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8788/auth/sign-out");
    expect(init.credentials).toBe("include");
  });
});

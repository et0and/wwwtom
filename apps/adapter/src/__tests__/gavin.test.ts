import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import type { CloudflareEnv } from "@tom/utils/config";
import { app } from "../index";
import {
  fetchMock,
  jsonResponse,
  requestWithEnv,
  stubFetch,
  testEnv,
  unstubFetch,
} from "../test/helpers";

beforeEach(stubFetch);

afterEach(unstubFetch);

type FrameKv = NonNullable<CloudflareEnv["FRAME_KV"]>;

const createKv = (initial?: string): FrameKv & { store: Map<string, string> } => {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set("state", initial);
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
  };
};

const envFor = (kv: FrameKv) =>
  testEnv({
    ADAPTER_URL: "https://adapter.tom.so",
    API_URL: "http://localhost:8787",
    INTERNAL_API_TOKEN: "adapter-token",
    CMS_ADMIN_EMAILS: "admin@example.com",
    FRAME_DEVICE_TOKEN: "device-token",
    FRAME_KV: kv,
  });

const gavinState = {
  mode: "gavin",
  channel: "imaginary-museum",
  streamUrl: null,
  gavinMood: "idle",
  updatedAt: "2026-11-09T00:00:00.000Z",
};

const session = (email: string) => jsonResponse({ user: { email } });

describe("PUT /frame/gavin", () => {
  it("updates Gavin's mood when Gavin mode is active", async () => {
    const kv = createKv(JSON.stringify(gavinState));
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      requestWithEnv("https://adapter.tom.so/frame/gavin", envFor(kv), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth.session_token=abc",
          origin: "https://tom.so",
        },
        body: JSON.stringify({ mood: "listening" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gavinMood: "listening" });
    expect(JSON.parse(kv.store.get("state") ?? "{}")).toMatchObject({ gavinMood: "listening" });
  });

  it("rejects a mood update when Gavin mode is not active", async () => {
    const kv = createKv(JSON.stringify({ ...gavinState, mode: "deck" }));
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      requestWithEnv("https://adapter.tom.so/frame/gavin", envFor(kv), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth.session_token=abc",
          origin: "https://tom.so",
        },
        body: JSON.stringify({ mood: "listening" }),
      }),
    );

    expect(response.status).toBe(409);
  });

  it("rejects an untrusted origin", async () => {
    const kv = createKv(JSON.stringify(gavinState));

    const response = await app.fetch(
      requestWithEnv("https://adapter.tom.so/frame/gavin", envFor(kv), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ mood: "listening" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /gavin/respond", () => {
  it("proxies the transcript to the API with the internal token", async () => {
    fetchMock
      .mockResolvedValueOnce(session("admin@example.com"))
      .mockResolvedValueOnce(jsonResponse({ reply: "Hello.", mood: "happy" }));

    const response = await app.fetch(
      requestWithEnv("https://adapter.tom.so/gavin/respond", envFor(createKv()), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth.session_token=abc",
          origin: "https://tom.so",
        },
        body: JSON.stringify({ transcript: "Hello Gavin" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "Hello.", mood: "happy" });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://localhost:8787/gavin/respond");
    expect(new Headers(init.headers).get(INTERNAL_TOKEN_HEADER)).toBe("adapter-token");
    expect(JSON.parse(init.body as string)).toEqual({ transcript: "Hello Gavin" });
  });

  it("rejects the Sophie adapter before calling the API", async () => {
    const response = await app.fetch(
      requestWithEnv(
        "https://adapter.tom.so/gavin/respond",
        { ...envFor(createKv()), TENANT: "sophie" },
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://sophie.st",
          },
          body: JSON.stringify({ transcript: "Hello Gavin" }),
        },
      ),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    const response = await app.fetch(
      requestWithEnv("https://adapter.tom.so/gavin/respond", envFor(createKv()), {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://tom.so" },
        body: JSON.stringify({ transcript: "Hello Gavin" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

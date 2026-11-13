import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { settledGavinMood, type GavinMood } from "@tom/schemas/gavin";
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

const createKv = (
  initial: ReadonlyArray<readonly [string, string]> = [],
): FrameKv & { store: Map<string, string> } => {
  const store = new Map(initial);
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

const gavinState = JSON.stringify({
  mode: "gavin",
  channel: "imaginary-museum",
  updatedAt: "2026-11-09T00:00:00.000Z",
});

const session = (email: string) => jsonResponse({ user: { email } });

const moodRequest = (
  env: ReturnType<typeof envFor>,
  body: { readonly mood: string },
  origin = "https://tom.so",
) =>
  requestWithEnv("https://adapter.tom.so/frame/gavin", env, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: "better-auth.session_token=abc",
      origin,
    },
    body: JSON.stringify(body),
  });

describe("PUT /frame/gavin", () => {
  it("updates only the mood key while Gavin mode is active", async () => {
    const kv = createKv([["state", gavinState]]);
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(moodRequest(envFor(kv), { mood: "listening" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mode: "gavin",
      channel: "imaginary-museum",
      gavinMood: "listening",
      updatedAt: expect.any(String),
    });
    expect(kv.store.get("state")).toBe(gavinState);
    expect(JSON.parse(kv.store.get("gavin-mood") ?? "{}")).toEqual({
      mood: "listening",
      updatedAt: expect.any(String),
    });
  });

  it("rejects a mood update when Gavin mode is not active", async () => {
    const kv = createKv([
      [
        "state",
        JSON.stringify({ mode: "deck", channel: null, updatedAt: "2026-11-09T00:00:00.000Z" }),
      ],
      ["gavin-mood", JSON.stringify({ mood: "happy", updatedAt: "2026-11-09T00:00:00.000Z" })],
    ]);
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(moodRequest(envFor(kv), { mood: "listening" }));

    expect(response.status).toBe(409);
    expect(JSON.parse(kv.store.get("gavin-mood") ?? "{}")).toMatchObject({ mood: "happy" });
  });

  it("rejects an invalid mood", async () => {
    const kv = createKv([["state", gavinState]]);

    const response = await app.fetch(moodRequest(envFor(kv), { mood: "angry" }));

    expect(response.status).toBe(400);
    expect(kv.store.get("gavin-mood")).toBeUndefined();
  });

  it("rejects an untrusted origin", async () => {
    const response = await app.fetch(
      moodRequest(
        envFor(createKv([["state", gavinState]])),
        { mood: "listening" },
        "https://evil.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Gavin mood transitions", () => {
  it("settles transient moods to idle and keeps settled faces", () => {
    const transient: ReadonlyArray<GavinMood> = ["listening", "thinking", "speaking"];
    const settled: ReadonlyArray<GavinMood> = ["idle", "happy", "sleepy", "surprised"];

    expect(transient.map(settledGavinMood)).toEqual(["idle", "idle", "idle"]);
    expect(settled.map(settledGavinMood)).toEqual(settled);
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

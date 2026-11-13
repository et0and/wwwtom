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

const stateRequest = (env: ReturnType<typeof envFor>, init?: RequestInit): Request =>
  requestWithEnv("https://adapter.tom.so/frame/state", env, init);

const deviceHeaders = { authorization: "Bearer device-token" };

const session = (email: string) => jsonResponse({ user: { email } });

const UPDATED_AT = "2026-11-09T00:00:00.000Z";

const storedState = (mode: string, channel: string | null = "imaginary-museum") =>
  JSON.stringify({ mode, channel, updatedAt: UPDATED_AT });

const moodRecord = (mood: string) => JSON.stringify({ mood, updatedAt: UPDATED_AT });

const putRequest = <B>(env: ReturnType<typeof envFor>, body: B, origin = "https://tom.so") =>
  requestWithEnv("https://adapter.tom.so/frame/state", env, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: "better-auth.session_token=abc",
      origin,
    },
    body: JSON.stringify(body),
  });

describe("GET /frame/state", () => {
  it("returns the default deck state to the device token", async () => {
    const response = await app.fetch(stateRequest(envFor(createKv()), { headers: deviceHeaders }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      mode: "deck",
      channel: null,
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("adds Gavin's mood only while Gavin mode is stored", async () => {
    const kv = createKv([
      ["state", storedState("gavin")],
      ["gavin-mood", moodRecord("happy")],
    ]);

    const response = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));

    expect(await response.json()).toEqual({
      mode: "gavin",
      channel: "imaginary-museum",
      gavinMood: "happy",
      updatedAt: UPDATED_AT,
    });
  });

  it("uses the newer timestamp when Gavin's mood has changed since the mode", async () => {
    const kv = createKv([
      ["state", JSON.stringify({ mode: "gavin", channel: null, updatedAt: UPDATED_AT })],
      ["gavin-mood", JSON.stringify({ mood: "happy", updatedAt: "2026-11-10T00:00:00.000Z" })],
    ]);

    const response = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));

    expect(await response.json()).toMatchObject({
      mode: "gavin",
      gavinMood: "happy",
      updatedAt: "2026-11-10T00:00:00.000Z",
    });
  });

  it("defaults Gavin's mood to idle when no mood has been written", async () => {
    const kv = createKv([["state", storedState("gavin")]]);

    const response = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));

    expect(await response.json()).toMatchObject({ mode: "gavin", gavinMood: "idle" });
  });

  it("reads a retired video document as deck without its stream URL", async () => {
    const kv = createKv([
      [
        "state",
        JSON.stringify({
          mode: "video",
          channel: "imaginary-museum",
          streamUrl: "https://example.com/stream.mjpg",
          gavinMood: "idle",
          updatedAt: UPDATED_AT,
        }),
      ],
    ]);

    const response = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));

    expect(await response.json()).toEqual({
      mode: "deck",
      channel: "imaginary-museum",
      updatedAt: UPDATED_AT,
    });
  });

  it("falls back to the default state when the stored document is invalid", async () => {
    const kv = createKv([["state", "not json"]]);

    const response = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));

    expect(await response.json()).toEqual({
      mode: "deck",
      channel: null,
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("rejects a missing or wrong device token", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    const missing = await app.fetch(stateRequest(envFor(kv)));
    const callsAfterMissing = fetchMock.mock.calls.length;
    const wrong = await app.fetch(
      stateRequest(envFor(kv), { headers: { authorization: "Bearer wrong" } }),
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    // A missing Authorization header is indistinguishable from the web UI,
    // so it checks the admin session; an invalid bearer is rejected locally.
    expect(callsAfterMissing).toBe(1);
    expect(fetchMock.mock.calls.length).toBe(callsAfterMissing);
  });

  it("accepts an admin session", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      stateRequest(envFor(kv), {
        headers: { cookie: "better-auth.session_token=abc" },
      }),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8787/auth/get-session");
    expect(new Headers(init.headers).get(INTERNAL_TOKEN_HEADER)).toBe("adapter-token");
  });

  it("rejects a signed-in non-admin", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("someone@example.com"));

    const response = await app.fetch(
      stateRequest(envFor(kv), {
        headers: { cookie: "better-auth.session_token=abc" },
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe("PUT /frame/state", () => {
  it.each(["deck", "clock", "gavin", "off"] as const)("accepts %s mode", async (mode) => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(putRequest(envFor(kv), { mode, channel: null }));

    expect(response.status).toBe(200);
    const saved: unknown = await response.json();
    expect(saved).toMatchObject({ mode, channel: null });
    expect(saved).not.toHaveProperty("streamUrl");
    if (mode === "gavin") {
      expect(saved).toHaveProperty("gavinMood", "idle");
    } else {
      expect(saved).not.toHaveProperty("gavinMood");
    }
    expect(JSON.parse(kv.store.get("state") ?? "{}")).toEqual({
      mode,
      channel: null,
      updatedAt: expect.any(String),
    });
  });

  it("writes the mode and channel for an admin", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      putRequest(envFor(kv), { mode: "clock", channel: "imaginary-museum" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mode: "clock",
      channel: "imaginary-museum",
    });
    expect(JSON.parse(kv.store.get("state") ?? "{}")).toEqual({
      mode: "clock",
      channel: "imaginary-museum",
      updatedAt: expect.any(String),
    });
  });

  it("keeps the stored mood when Gavin mode is re-saved", async () => {
    const kv = createKv([["gavin-mood", moodRecord("happy")]]);
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      putRequest(envFor(kv), { mode: "gavin", channel: "imaginary-museum" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "gavin", gavinMood: "happy" });
    expect(kv.store.get("gavin-mood")).toBe(moodRecord("happy"));
  });

  it.each(["video", "not-a-mode"] as const)("rejects %s mode", async (mode) => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(putRequest(envFor(kv), { mode, channel: "imaginary-museum" }));

    expect(response.status).toBe(400);
    expect(kv.store.size).toBe(0);
  });

  it("rejects an empty channel", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(putRequest(envFor(kv), { mode: "deck", channel: "" }));

    expect(response.status).toBe(400);
    expect(kv.store.size).toBe(0);
  });

  it("accepts a null channel for clock mode", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(putRequest(envFor(kv), { mode: "clock", channel: null }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "clock", channel: null });
  });

  it("rejects an untrusted origin before checking the session", async () => {
    const response = await app.fetch(
      putRequest(
        envFor(createKv()),
        { mode: "clock", channel: "imaginary-museum" },
        "https://evil.com",
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated write", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    const response = await app.fetch(
      putRequest(envFor(kv), { mode: "off", channel: "imaginary-museum" }),
    );

    expect(response.status).toBe(401);
    expect(kv.store.size).toBe(0);
  });

  it("keeps a mode change that lands while a mood write is in flight", async () => {
    const store = new Map<string, string>([["state", storedState("gavin")]]);
    const moodWriteStarted = Promise.withResolvers<void>();
    const releaseMoodWrite = Promise.withResolvers<void>();
    let hasPausedMoodWrite = false;
    const kv: FrameKv = {
      get: async (key) => store.get(key) ?? null,
      put: async (key, value) => {
        if (key === "gavin-mood" && !hasPausedMoodWrite) {
          hasPausedMoodWrite = true;
          moodWriteStarted.resolve();
          await releaseMoodWrite.promise;
        }
        store.set(key, value);
      },
    };
    fetchMock.mockImplementation(async () => session("admin@example.com"));

    // The mood request has read Gavin mode and is now writing its own key.
    const moodRequest = app.fetch(
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
    await moodWriteStarted.promise;

    const modeResponse = await app.fetch(
      putRequest(envFor(kv), { mode: "clock", channel: "imaginary-museum" }),
    );
    expect(modeResponse.status).toBe(200);

    releaseMoodWrite.resolve();
    const moodResponse = await moodRequest;
    expect(moodResponse.status).toBe(200);

    // The mood write only touches its own key, so the later mode survives.
    expect(JSON.parse(store.get("state") ?? "{}")).toMatchObject({ mode: "clock" });
    expect(JSON.parse(store.get("gavin-mood") ?? "{}")).toMatchObject({ mood: "listening" });

    const read = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));
    expect(await read.json()).toEqual({
      mode: "clock",
      channel: "imaginary-museum",
      updatedAt: expect.any(String),
    });
  });
});

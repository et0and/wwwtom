import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import type { FrameKvBinding } from "@tom/utils/config";
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

const createKv = (): FrameKvBinding & { store: Map<string, string> } => {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
  };
};

const envFor = (kv: FrameKvBinding) =>
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

describe("GET /frame/state", () => {
  it("returns the default state to the device token", async () => {
    const kv = createKv();
    const response = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      mode: "deck",
      channel: "imaginary-museum",
      streamUrl: null,
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

  it("writes the state for an admin", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      putRequest(envFor(kv), {
        mode: "clock",
        channel: "imaginary-museum",
        streamUrl: null,
      }),
    );

    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved).toMatchObject({ mode: "clock", channel: "imaginary-museum", streamUrl: null });
    expect(JSON.parse(kv.store.get("state") ?? "{}")).toMatchObject({ mode: "clock" });

    const read = await app.fetch(stateRequest(envFor(kv), { headers: deviceHeaders }));
    expect(await read.json()).toMatchObject({ mode: "clock" });
  });

  it("rejects an untrusted origin before checking the session", async () => {
    const kv = createKv();
    const response = await app.fetch(
      putRequest(
        envFor(kv),
        { mode: "clock", channel: "imaginary-museum", streamUrl: null },
        "https://evil.com",
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(session("admin@example.com"));

    const response = await app.fetch(
      putRequest(envFor(kv), {
        mode: "not-a-mode",
        channel: "imaginary-museum",
        streamUrl: null,
      }),
    );

    expect(response.status).toBe(400);
    expect(kv.store.size).toBe(0);
  });

  it("rejects an unauthenticated write", async () => {
    const kv = createKv();
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    const response = await app.fetch(
      putRequest(envFor(kv), {
        mode: "off",
        channel: "imaginary-museum",
        streamUrl: null,
      }),
    );

    expect(response.status).toBe(401);
    expect(kv.store.size).toBe(0);
  });
});

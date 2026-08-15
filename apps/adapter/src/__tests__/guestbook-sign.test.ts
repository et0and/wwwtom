import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const signGuestbookMock = vi.hoisted(() => vi.fn());

vi.mock("../integrations/guestbook/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../integrations/guestbook/auth")>();
  return {
    ...actual,
    signGuestbook: signGuestbookMock,
  };
});

const fetchMock = vi.fn();

const userCookie = encodeURIComponent(
  JSON.stringify({
    username: "tom",
    instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
    access_token: "token",
  }),
);

type SignBody = { message: string; token?: string | undefined };

type SiteverifyResult = { success: boolean; action?: string; hostname?: string };

const signRequest = (env: CloudflareEnv, body: SignBody) =>
  app.fetch(
    requestWithEnv("http://localhost/guestbook/sign", env, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `guestbook_user=${userCookie}` },
      body: JSON.stringify(body),
    }),
  );

const signEnv = () => testEnv({ TURNSTILE_SECRET: "test-secret" });

const mockSiteverify = (result: SiteverifyResult) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  signGuestbookMock.mockReset();
  signGuestbookMock.mockImplementation(() => Effect.succeed({ id: 1 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /guestbook/sign with Turnstile", () => {
  it("signs without verification when no secret is configured", async () => {
    const response = await signRequest(testEnv(), { message: "Hello" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(signGuestbookMock).toHaveBeenCalledWith(expect.objectContaining({ message: "Hello" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing token when a secret is configured", async () => {
    const response = await signRequest(signEnv(), { message: "Hello" });

    expect(response.status).toBe(400);
    expect(signGuestbookMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    mockSiteverify({ success: false });
    const response = await signRequest(signEnv(), { message: "Hello", token: "token-123" });

    expect(response.status).toBe(400);
    expect(signGuestbookMock).not.toHaveBeenCalled();
  });

  it("rejects a token for the wrong action", async () => {
    mockSiteverify({ success: true, action: "other-action", hostname: "tom.so" });
    const response = await signRequest(signEnv(), { message: "Hello", token: "token-123" });

    expect(response.status).toBe(400);
    expect(signGuestbookMock).not.toHaveBeenCalled();
  });

  it("rejects a token from an unexpected hostname", async () => {
    mockSiteverify({ success: true, action: "guestbook-sign", hostname: "evil.example.com" });
    const response = await signRequest(signEnv(), { message: "Hello", token: "token-123" });

    expect(response.status).toBe(400);
    expect(signGuestbookMock).not.toHaveBeenCalled();
  });

  it("rejects when siteverify is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const response = await signRequest(signEnv(), { message: "Hello", token: "token-123" });

    expect(response.status).toBe(400);
    expect(signGuestbookMock).not.toHaveBeenCalled();
  });

  it("signs when the token verifies", async () => {
    mockSiteverify({ success: true, action: "guestbook-sign", hostname: "tom.so" });
    const response = await signRequest(signEnv(), { message: "Hello", token: "token-123" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(signGuestbookMock).toHaveBeenCalledWith(expect.objectContaining({ message: "Hello" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get("response")).toBe("token-123");
    expect(body.get("secret")).toBe("test-secret");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import type { GoogleRefreshRequest, GoogleTokenRequest } from "../oauth/google/shared";
import { requestWithEnv, testEnv } from "../test/helpers";

const clientId = "client-id.apps.googleusercontent.com";
const clientSecret = "test-client-secret";
const redirectUri = "http://127.0.0.1:53682/oauth2callback";
const verifier = "a".repeat(64);

const oauthEnv = (overrides: Parameters<typeof testEnv>[0] = {}) =>
  testEnv({
    GOOGLE_OAUTH_CLIENTS: JSON.stringify({ [clientId]: clientSecret }),
    ...overrides,
  });

const tokenRequest = (
  path: string,
  body: GoogleTokenRequest | GoogleRefreshRequest,
  env = oauthEnv(),
) =>
  app.fetch(
    requestWithEnv(`http://localhost${path}`, env, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const formFrom = (init: RequestInit | undefined): URLSearchParams => {
  const body = init?.body;
  return body instanceof URLSearchParams ? body : new URLSearchParams();
};

const tokenResponse = () =>
  new Response(
    JSON.stringify({
      access_token: "access-token",
      expires_in: 3600,
      id_token: "identity-token",
      refresh_token: "refresh-token",
      scope: "https://www.googleapis.com/auth/drive.readonly",
      token_type: "Bearer",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google OAuth token broker", () => {
  it("exchanges a PKCE code with the server-side secret", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(tokenResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const response = await tokenRequest("/oauth/google/token", {
      client_id: clientId,
      code: "authorization-code",
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(await response.json()).toEqual({
      access_token: "access-token",
      expires_in: 3600,
      id_token: "identity-token",
      refresh_token: "refresh-token",
      scope: "https://www.googleapis.com/auth/drive.readonly",
      token_type: "Bearer",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toBe("https://oauth2.googleapis.com/token");
    const form = formFrom(call?.[1]);
    expect(form.get("client_secret")).toBe(clientSecret);
    expect(form.get("code_verifier")).toBe(verifier);
    expect(form.get("redirect_uri")).toBe(redirectUri);
    expect(form.get("grant_type")).toBe("authorization_code");
  });

  it("refreshes a token with the server-side secret", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: "new-access-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await tokenRequest("/oauth/google/refresh", {
      client_id: clientId,
      refresh_token: "refresh-token",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    const form = formFrom(fetchMock.mock.calls[0]?.[1]);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("refresh-token");
    expect(form.get("client_secret")).toBe(clientSecret);
  });

  it("rejects an unknown client without calling Google", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await tokenRequest("/oauth/google/token", {
      client_id: "unknown-client",
      code: "authorization-code",
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects inherited object properties as client IDs", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await tokenRequest("/oauth/google/token", {
      client_id: "constructor",
      code: "authorization-code",
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-loopback redirect", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await tokenRequest("/oauth/google/token", {
      client_id: clientId,
      code: "authorization-code",
      code_verifier: verifier,
      redirect_uri: "https://evil.example/callback",
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the broker has no client map", async () => {
    const response = await tokenRequest(
      "/oauth/google/token",
      {
        client_id: clientId,
        code: "authorization-code",
        code_verifier: verifier,
        redirect_uri: redirectUri,
      },
      testEnv(),
    );

    expect(response.status).toBe(500);
  });
});

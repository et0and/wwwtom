import { vi } from "vitest";
import type { CloudflareEnv } from "@tom/utils/services/config";
import type { RequestWithEnv } from "@tom/utils/services/worker";

export const fetchMock = vi.fn();

export const stubFetch = (): void => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
};

export const unstubFetch = (): void => {
  vi.unstubAllGlobals();
};

/**
 * Build a Request with the Cloudflare env attached the same way the worker's
 * fetch wrapper does, so Elysia's getRequestEnv can read it back.
 */
export const requestWithEnv = (url: string, env: CloudflareEnv, init?: RequestInit): Request => {
  const request = new Request(url, init);
  (request as RequestWithEnv).env = env;
  return request;
};

export const testEnv = (overrides: Partial<CloudflareEnv> = {}): CloudflareEnv => ({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://test",
  ...overrides,
});

export const userCookie = encodeURIComponent(
  JSON.stringify({
    username: "tom",
    instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
    access_token: "token",
  }),
);

export const jsonResponse = <T>(body: T, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

import type { Env } from "../config/effect";
import type { RequestWithEnv } from "../config/effect";

/**
 * Build a Request with the Cloudflare env attached the same way the worker's
 * fetch wrapper does, so Elysia's getRequestEnv can read it back.
 */
export const requestWithEnv = (url: string, env: Env, init?: RequestInit): Request => {
  const request = new Request(url, init);
  (request as RequestWithEnv).env = env;
  return request;
};

export const testEnv = (overrides: Partial<Env> = {}): Env => ({
  NODE_ENV: "test",
  ...overrides,
});

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

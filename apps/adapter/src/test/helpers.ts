import type { AdapterEnv } from "../config/effect";
import type { RequestWithEnv } from "../config/effect";

/**
 * Build a Request with the Cloudflare env attached the same way the worker's
 * fetch wrapper does, so Elysia's getRequestEnv can read it back.
 */
export const requestWithEnv = (url: string, env: AdapterEnv, init?: RequestInit): Request => {
  const request = new Request(url, init);
  (request as RequestWithEnv).env = env;
  return request;
};

export const testEnv = (overrides: Partial<AdapterEnv> = {}): AdapterEnv => ({
  NODE_ENV: "test",
  PAYLOAD_URL: "https://cms.tom.so",
  DATABASE_URL: "postgres://test",
  ...overrides,
});

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const payloadPostsResponse = {
  docs: [
    {
      id: 34,
      title: "A pattern language",
      summary: "On imagining a monorepo as a shared house",
      slug: "a-pattern-language",
      publishedAt: "2026-06-30T00:00:00.000Z",
      content: "<p>Some content</p>",
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      meta: { description: "A meta description" },
    },
  ],
  totalDocs: 1,
  limit: 5,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

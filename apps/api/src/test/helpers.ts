import { memoryAdapter } from "better-auth/adapters/memory";
import type { CloudflareEnv } from "@tom/utils/services/config";
import type { RequestWithEnv } from "@tom/utils/services/worker";

export type MemorySeedRow = Record<string, string | number | boolean | Date | null>;

/** In-memory database for tests (same Better Auth behavior, no D1). */
export const memoryDatabase = (
  seed: Record<string, Array<MemorySeedRow>> = {},
): ReturnType<typeof memoryAdapter> => memoryAdapter(seed);

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
  INTERNAL_API_TOKEN: "test-internal-token",
  ...overrides,
});

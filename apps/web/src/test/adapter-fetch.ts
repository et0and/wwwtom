import { vi, type Mock } from "vitest";

/** JSON response body the way the adapter returns it to the Eden client. */
export const jsonResponse = <T>(body: T, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Stub the global fetch at the network boundary. Tests then exercise the
 * real adapter client: URL building, response parsing, and error mapping.
 */
export const stubAdapterFetch = (): Mock => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

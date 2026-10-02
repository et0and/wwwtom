import { afterEach, describe, expect, it } from "vitest";
import { app } from "../index";
import { SIMULATOR_HEADER } from "../simulator";
import {
  fetchMock,
  jsonResponse,
  requestWithEnv,
  stubFetch,
  testEnv,
  unstubFetch,
} from "../test/helpers";

/**
 * The simulator branch is the only guestbook path that never touches D1, so
 * nothing else covers it. It is also the only one that trusts a shape it does
 * not own: the simulator returns DatabaseService's paged envelope, not a bare
 * array of entries.
 */
const SIMULATOR_URL = "http://localhost:8789";

const env = testEnv({ SIMULATOR_URL });

const entry = {
  id: 1,
  fediverse_username: "tom",
  fediverse_instance: "mastodon.social",
  display_name: "Tom",
  avatar_url: null,
  message: "hello from the fixture store",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/** The envelope apps/simulator actually returns. */
const envelope = <T>(results: ReadonlyArray<T>) => ({
  results,
  page: 1,
  page_size: 100,
  total_count: results.length,
});

const getEntries = () =>
  app.fetch(
    requestWithEnv("http://localhost/guestbook/entries", env, {
      headers: { [SIMULATOR_HEADER]: "1" },
    }),
  );

describe("guestbook entries from the simulator", () => {
  afterEach(unstubFetch);

  it("reads entries out of the paged envelope", async () => {
    stubFetch();
    fetchMockResponse(envelope([entry]));

    const response = await getEntries();
    expect(response.status).toBe(200);
    // The adapter unwraps the envelope and answers with the bare array its
    // route response declares; the web client reads exactly that.
    const body = (await response.json()) as ReadonlyArray<{ message: string }>;
    expect(body.map((item) => item.message)).toEqual([entry.message]);
  });

  it("rejects a bare entry array rather than silently returning nothing", async () => {
    stubFetch();
    fetchMockResponse([entry]);

    const response = await getEntries();
    expect(response.status).toBe(502);
  });
});

const fetchMockResponse = <T>(body: T): void => {
  fetchMock.mockResolvedValue(jsonResponse(body));
};

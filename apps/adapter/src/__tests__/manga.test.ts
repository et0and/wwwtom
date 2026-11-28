import { Effect, Redacted } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MangaManifestSchema,
  requireReaderSession,
  titleById,
  type MangaEnv,
} from "../manga/shared";

const env: MangaEnv = {
  B2_ENDPOINT: "https://s3.example.backblazeb2.com",
  B2_BUCKET: "manga",
  B2_KEY_ID: Redacted.make("key"),
  B2_APP_KEY: Redacted.make("secret"),
  API_URL: "https://api.tom.so",
  INTERNAL_API_TOKEN: "internal",
};

const request = new Request("https://adapter.tom.so/manga/manifest");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("manga reader gate", () => {
  it("accepts a signed-in session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              session: { id: "session-1" },
              user: { email: "reader@example.com" },
            }),
            { status: 200 },
          ),
      ),
    );
    await Effect.runPromise(requireReaderSession(request, env));
  });

  it("rejects a signed-out reader", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    const error = await Effect.runPromise(Effect.flip(requireReaderSession(request, env)));
    expect(error.status).toBe(401);
  });

  it("rejects null and malformed sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("null", { status: 200 })),
    );
    const error = await Effect.runPromise(Effect.flip(requireReaderSession(request, env)));
    expect(error.status).toBe(401);
  });

  it("validates the manifest and only exposes listed titles", () => {
    const manifest = MangaManifestSchema.make({
      titles: [{ id: "one", title: "One", archiveKey: "manga/one.cbz" }],
    });
    expect(titleById(manifest, "one")?.title).toBe("One");
    expect(titleById(manifest, "other")).toBeUndefined();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const internalHeaders = {
  [INTERNAL_TOKEN_HEADER]: "test-internal-token",
  "content-type": "application/json",
};

const gavinEnv = (overrides = {}) =>
  testEnv({
    OPENCODE_GO_BASE_URL: "https://opencode.example/v1",
    OPENCODE_GO_API_KEY: "test-key",
    ...overrides,
  });

const ask = (env = gavinEnv(), transcript = "Hello Gavin") =>
  app.fetch(
    requestWithEnv("http://localhost/gavin/respond", env, {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({ transcript }),
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /gavin/respond", () => {
  it("returns the model reply and mood", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({ reply: "Hello. I see you.", mood: "happy" }),
          output: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await ask();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "Hello. I see you.", mood: "happy" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://opencode.example/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
          "x-opencode-session": "gavin-desk-frame",
        }),
      }),
    );
  });

  it("falls back to the text when the model does not return JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "Just a plain reply." }],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const response = await ask();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "Just a plain reply.", mood: "idle" });
  });

  it("returns 503 when the OpenCode Go credentials are missing", async () => {
    const response = await ask(testEnv());

    expect(response.status).toBe(503);
  });

  it("rejects the Sophie tenant", async () => {
    const response = await ask(testEnv({ TENANT: "sophie" }));

    expect(response.status).toBe(404);
  });

  it("maps a network failure to 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const response = await ask();

    expect(response.status).toBe(502);
  });

  it("returns 502 when the model request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const response = await ask();

    expect(response.status).toBe(502);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("og route", () => {
  it("accepts commas in title/summary (Elysia splits them into lists)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));

    // Before the fix Elysia's standard-schema parser turned the comma value
    // into an array and failed String validation with a 400 before the
    // handler ran. The route must now reach the handler (font fetch 502 or
    // successful generation) — never the query-validation 400.
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi,Tom&summary=Aotearoa,New%20Zealand", testEnv()),
    );

    expect(response.status).not.toBe(400);
    expect(response.status).not.toBe(401);
  });
});

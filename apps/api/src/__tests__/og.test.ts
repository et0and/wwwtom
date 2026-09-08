import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";
import { OgTemplates } from "@tom/ui/OgImage";
import { getTemplate } from "../services/og";

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("renders a PNG through the stubbed renderer", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=sophie", testEnv()),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("rejects an unknown template with a 400", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=bogus", testEnv()),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an over-long date with a 400", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const date = "January 29, 2016, plus extra words making this far too long";
    const response = await app.fetch(
      requestWithEnv(
        `http://localhost/og?title=Hi&summary=Hello&date=${encodeURIComponent(date)}`,
        testEnv(),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("ignores a ?requester= override (Referer alone drives auto-select)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const sophieSpy = vi.spyOn(OgTemplates, "sophie");
    const minimalSpy = vi.spyOn(OgTemplates, "minimal");

    const response = await app.fetch(
      requestWithEnv(
        "http://localhost/og?title=Hi&summary=Hello&requester=https://sophie.st",
        testEnv(),
      ),
    );

    expect(response.status).toBe(200);
    expect(sophieSpy).not.toHaveBeenCalled();
    expect(minimalSpy).toHaveBeenCalled();
  });

  it("auto-selects sophie from the Referer header", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const sophieSpy = vi.spyOn(OgTemplates, "sophie");

    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello", testEnv(), {
        headers: { Referer: "https://sophie.st/posts/hi" },
      }),
    );

    expect(response.status).toBe(200);
    expect(sophieSpy).toHaveBeenCalled();
  });

  it("treats an explicit template as authoritative over the Referer", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const developerSpy = vi.spyOn(OgTemplates, "developer");
    const sophieSpy = vi.spyOn(OgTemplates, "sophie");

    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=developer", testEnv(), {
        headers: { Referer: "https://sophie.st/posts/hi" },
      }),
    );

    expect(response.status).toBe(200);
    expect(developerSpy).toHaveBeenCalled();
    expect(sophieSpy).not.toHaveBeenCalled();
  });

  it("still renders sophie when Solway fails (fallback serif, no 502)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValue(new Error("font host down"));
    // Fresh module registry: the font cache is module-level, so without
    // this an earlier test's cached Solway bytes would mask the failure.
    vi.resetModules();
    const { app: freshApp } = await import("../index");
    const response = await freshApp.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=sophie", testEnv()),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});

describe("getTemplate", () => {
  it("selects the Sophie template on explicit request", () => {
    expect(getTemplate("https://tom.so", "sophie")).toBe(OgTemplates.sophie);
  });

  it("selects the Sophie template for Sophie requesters", () => {
    expect(getTemplate("https://sophie.st/posts/hi", undefined)).toBe(OgTemplates.sophie);
  });

  it("keeps Tom requesters on the default template", () => {
    expect(getTemplate("https://tom.so/posts/hi", undefined)).toBe(OgTemplates.default);
  });

  it("accepts a date line without a 400", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const response = await app.fetch(
      requestWithEnv(
        "http://localhost/og?title=Wet&summary=Don%27t%20you&date=January%2029,%202016&template=sophie",
        testEnv(),
      ),
    );
    expect(response.status).not.toBe(400);
    expect(response.status).not.toBe(401);
  });
});

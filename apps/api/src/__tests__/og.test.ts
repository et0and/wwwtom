import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";
import { OgTemplates } from "@tom/ui/OgImage";
import { getTemplate } from "../services/og";

const fetchMock = vi.fn(
  async (_input: string): Promise<Response> => new Response(new ArrayBuffer(8)),
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Fonts load from the worker's own /fonts/* assets: stub the fetch with
// fixture bytes (takumi's render is stubbed in test setup) and assert every
// call stays same-origin, proving no third-party fetch happens.
const stubLocalFonts = (): void => {
  vi.stubGlobal("fetch", fetchMock);
};

const fetchedUrls = (): Array<string> => fetchMock.mock.calls.map((call) => new URL(call[0]).href);

describe("og route", () => {
  it("accepts commas in title/summary (Elysia splits them into lists)", async () => {
    stubLocalFonts();
    // Before the fix Elysia's standard-schema parser turned the comma value
    // into an array and failed String validation with a 400 before the
    // handler ran. The route must now reach the handler — never the
    // query-validation 400.
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi,Tom&summary=Aotearoa,New%20Zealand", testEnv()),
    );

    expect(response.status).not.toBe(400);
    expect(response.status).not.toBe(401);
  });

  it("renders a PNG through the stubbed renderer", async () => {
    stubLocalFonts();
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=sophie", testEnv()),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("renders without any third-party fetch (fonts ship as worker assets)", async () => {
    stubLocalFonts();
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=sophie", testEnv()),
    );

    expect(response.status).toBe(200);
    const urls = fetchedUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith("http://localhost/fonts/")).toBe(true);
    }
  });

  it("rejects an unknown template with a 400", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi&summary=Hello&template=bogus", testEnv()),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an over-long date with a 400", async () => {
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
    stubLocalFonts();
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
    stubLocalFonts();
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
    stubLocalFonts();
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

  it("rejects lookalike domains to the minimal template", () => {
    expect(getTemplate("https://evil-sophie.st/posts", undefined)).toBe(OgTemplates.minimal);
    expect(getTemplate("https://sophie.st.evil.com/posts", undefined)).toBe(OgTemplates.minimal);
    expect(getTemplate("https://eviltom.so/posts", undefined)).toBe(OgTemplates.minimal);
    expect(getTemplate("https://tom.so.evil.com/posts", undefined)).toBe(OgTemplates.minimal);
    expect(getTemplate("not a url", undefined)).toBe(OgTemplates.minimal);
  });

  it("accepts a date line without a 400", async () => {
    stubLocalFonts();
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

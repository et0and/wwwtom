import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../index";
import { fetchMock, requestWithEnv, stubFetch, testEnv, unstubFetch } from "../test/helpers";

beforeEach(stubFetch);

afterEach(unstubFetch);

const tomEnv = testEnv({ TENANT: "tom" });

describe("GET /weather/:location", () => {
  it("returns ASCII conditions from wttr.in", async () => {
    fetchMock.mockResolvedValue(
      new Response("Patchy rain nearby|+16°C", {
        headers: { "Content-Type": "text/plain" },
      }),
    );

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      location: "Wellington",
      condition: "Patchy rain nearby",
      temperature: "+16C",
    });
    expect(response.headers.get("Cache-Control")).toContain("max-age=900");

    const firstCall = fetchMock.mock.calls[0] as [RequestInfo, RequestInit?];
    const requested = new URL(String(firstCall[0]));
    expect(requested.origin).toBe("https://wttr.in");
    expect(requested.pathname).toBe("/Wellington");
    expect(requested.searchParams.get("format")).toBe("%C|%t");
  });

  it("rejects an invalid location before calling upstream", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/weather/%2E%2E%2Fetc", tomEnv),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an upstream failure to 502", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(502);
  });
});

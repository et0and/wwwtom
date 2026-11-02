import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../index";
import {
  fetchMock,
  jsonResponse,
  requestWithEnv,
  stubFetch,
  testEnv,
  unstubFetch,
} from "../test/helpers";

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
    expect(requested.searchParams.has("m")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Open-Meteo when wttr.in fails", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("nope", { status: 502 }))
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ latitude: -41.28664, longitude: 174.77557 }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ current: { temperature_2m: 16.4, weather_code: 61 } }));

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      location: "Wellington",
      condition: "Rain",
      temperature: "+16C",
    });

    const calls = fetchMock.mock.calls as Array<[RequestInfo, RequestInit?]>;
    const geocodingCall = calls[1];
    const forecastCall = calls[2];
    expect(geocodingCall).toBeDefined();
    expect(forecastCall).toBeDefined();
    if (geocodingCall === undefined || forecastCall === undefined) return;

    const geocoding = new URL(String(geocodingCall[0]));
    expect(geocoding.hostname).toBe("geocoding-api.open-meteo.com");
    expect(geocoding.searchParams.get("name")).toBe("Wellington");

    const forecast = new URL(String(forecastCall[0]));
    expect(forecast.hostname).toBe("api.open-meteo.com");
    expect(forecast.searchParams.get("latitude")).toBe("-41.28664");
    expect(forecast.searchParams.get("longitude")).toBe("174.77557");
    expect(forecast.searchParams.get("current")).toBe("temperature_2m,weather_code");
  });

  it("formats negative Open-Meteo temperatures", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("nope", { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ latitude: 1, longitude: 2 }] }))
      .mockResolvedValueOnce(jsonResponse({ current: { temperature_2m: -2.6, weather_code: 95 } }));

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      condition: "Thunderstorm",
      temperature: "-3C",
    });
  });

  it("returns 502 when Open-Meteo cannot geocode the location", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("nope", { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalises whitespace and strips non-ASCII", async () => {
    fetchMock.mockResolvedValue(new Response("  Partly   cloudy ☀|+16 °C  "));

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      condition: "Partly cloudy",
      temperature: "+16C",
    });
  });

  it("rejects an empty reading", async () => {
    fetchMock.mockResolvedValue(new Response("|"));

    const response = await app.fetch(requestWithEnv("http://localhost/weather/Wellington", tomEnv));

    expect(response.status).toBe(502);
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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
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

const env = testEnv({
  API_URL: "http://localhost:8787",
  ADAPTER_URL: "http://localhost:8788",
  INTERNAL_API_TOKEN: "adapter-token",
  TENANT: "tom",
});

const call = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init } satisfies { readonly url: string; readonly init: RequestInit };
};

describe("CRM proxy", () => {
  it("forwards reads to the API with the internal token and cookies", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ docs: [] }));
    const response = await app.fetch(
      requestWithEnv("http://localhost/crm/assets", env, {
        headers: { cookie: "better-auth.session_token=abc" },
      }),
    );

    expect(response.status).toBe(200);
    expect(call().url).toBe("http://localhost:8787/assets");
    expect(call().init.method).toBe("GET");
    expect(new Headers(call().init.headers).get(INTERNAL_TOKEN_HEADER)).toBe("adapter-token");
    expect(new Headers(call().init.headers).get("cookie")).toBe("better-auth.session_token=abc");
  });

  it("forwards multipart asset creation", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "asset-1" }, 201));
    const form = new FormData();
    form.append("name", "Camera");
    const response = await app.fetch(
      requestWithEnv("http://localhost/crm/assets", env, {
        method: "POST",
        headers: { origin: "http://localhost:5175" },
        body: form,
      }),
    );

    expect(response.status).toBe(201);
    expect(call().url).toBe("http://localhost:8787/assets");
    expect(call().init.method).toBe("POST");
    expect(call().init.body).toBeInstanceOf(ArrayBuffer);
  });

  it("rejects CRM writes without an origin", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/crm/assets", env, {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized CRM bodies before forwarding", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/crm/assets", env, {
        method: "POST",
        headers: {
          origin: "http://localhost:5175",
          "content-length": String(51 * 1024 * 1024),
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects untrusted CRM origins", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/crm/assets", env, {
        method: "POST",
        headers: { origin: "https://evil.example.com" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

describe("openapi docs", () => {
  it("serves the Scalar docs UI from the root", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/", testEnv()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("scalar");
  });

  it("serves the OpenAPI spec", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", testEnv()));
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("Tom API");
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/health", "/checkout", "/portal", "/og"]),
    );
  });
});

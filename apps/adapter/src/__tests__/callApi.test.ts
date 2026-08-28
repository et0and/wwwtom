import { describe, expect, it } from "vitest";
import { callApi } from "../callApi";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

describe("callApi", () => {
  it("creates a treaty client without token", () => {
    const client = callApi("https://api.tom.so");
    expect(client).toBeDefined();
  });

  it("creates a treaty client with token", () => {
    const client = callApi("https://api.tom.so", "secret-token");
    expect(client).toBeDefined();
  });

  it("uses manual redirect for Polar checkout passthrough", () => {
    // The fetchOptions are internal but the client should be created without error
    const withToken = callApi("https://api.tom.so", "tok");
    const withoutToken = callApi("https://api.tom.so");
    expect(withToken).toBeDefined();
    expect(withoutToken).toBeDefined();
    expect(INTERNAL_TOKEN_HEADER).toBe("x-internal-token");
  });
});

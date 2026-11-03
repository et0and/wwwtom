import { describe, expect, it } from "vitest";
import { hasSessionCredential } from "../src/session";

const requestWithHeaders = (headers: HeadersInit): Request =>
  new Request("https://tom.so/content/posts", { headers });

describe("hasSessionCredential", () => {
  it("detects a better-auth session cookie", () => {
    expect(
      hasSessionCredential(requestWithHeaders({ cookie: "better-auth.session_token=abc" })),
    ).toBe(true);
  });

  it("detects a secure session cookie and session data", () => {
    expect(
      hasSessionCredential(
        requestWithHeaders({
          cookie: "__Secure-better-auth.session_token=abc",
        }),
      ),
    ).toBe(true);
    expect(
      hasSessionCredential(requestWithHeaders({ cookie: "better-auth.session_data=abc" })),
    ).toBe(true);
  });

  it("detects a session cookie among other cookies", () => {
    expect(
      hasSessionCredential(
        requestWithHeaders({
          cookie: "theme=dark; __Secure-better-auth.session_data=abc; x=y",
        }),
      ),
    ).toBe(true);
    expect(
      hasSessionCredential(
        requestWithHeaders({ cookie: "theme=dark;better-auth.session_token=abc" }),
      ),
    ).toBe(true);
  });

  it("ignores cookies that only resemble a session", () => {
    const lookalikes = [
      "better-auth.state-abc=xyz",
      "better-auth.session_token_extra=abc",
      "theme=better-auth.session_token=abc",
      "xbetter-auth.session_token=abc",
    ];

    for (const cookie of lookalikes) {
      expect(hasSessionCredential(requestWithHeaders({ cookie }))).toBe(false);
    }
  });

  it("detects a bearer authorization header case-insensitively", () => {
    for (const authorization of ["Bearer token", "bearer token", "BEARER token", "Bearer  token"]) {
      expect(hasSessionCredential(requestWithHeaders({ authorization }))).toBe(true);
    }
  });

  it("ignores other authorization schemes and an empty bearer token", () => {
    for (const authorization of [
      "Basic token",
      "NotBearer token",
      "Bearer token extra",
      "Bearer",
      "Bearer ",
      "bearer   ",
    ]) {
      expect(hasSessionCredential(requestWithHeaders({ authorization }))).toBe(false);
    }
  });

  it("returns false without a cookie or authorization header", () => {
    expect(hasSessionCredential(requestWithHeaders({}))).toBe(false);
  });
});

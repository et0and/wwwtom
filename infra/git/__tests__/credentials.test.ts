import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { isAllowedEmail } from "../src/auth.ts";
import { resolveGitUser, type GitCredentialSource } from "../src/credentials.ts";

const basicRequest = (password: string): Request =>
  new Request("https://git.tom.so/api/v1/repos", {
    headers: { authorization: `Basic ${btoa(`x:${password}`)}` },
  });

const anonymousRequest = (): Request =>
  new Request("https://git.tom.so/api/v1/repos", {
    headers: { cookie: "better-auth.session_token=abc" },
  });

const credentialSource = (options: {
  readonly apiKey?: { readonly valid: boolean; readonly referenceId: string };
  readonly sessionUserId?: string;
}): GitCredentialSource => ({
  api: {
    verifyApiKey: async () => ({
      valid: options.apiKey?.valid ?? false,
      key: options.apiKey === undefined ? null : { referenceId: options.apiKey.referenceId },
    }),
    getSession: async () =>
      options.sessionUserId === undefined ? null : { user: { id: options.sessionUserId } },
  },
});

const resolve = (auth: GitCredentialSource, request: Request) =>
  Effect.runPromise(
    resolveGitUser(auth).pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(request),
      ),
      Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
    ),
  );

describe("Git credential resolution", () => {
  it("resolves a valid API key to its owner", async () => {
    const user = await resolve(
      credentialSource({ apiKey: { valid: true, referenceId: "User_ABC" } }),
      basicRequest("git-key"),
    );

    expect(user).toEqual({ id: "user_abc" });
  });

  it("rejects an invalid API key", async () => {
    const user = await resolve(
      credentialSource({ apiKey: { valid: false, referenceId: "user_abc" } }),
      basicRequest("wrong-key"),
    );

    expect(user).toBeNull();
  });

  it("resolves a session cookie when no API key is sent", async () => {
    const user = await resolve(credentialSource({ sessionUserId: "User_DEF" }), anonymousRequest());

    expect(user).toEqual({ id: "user_def" });
  });

  it("rejects a request without credentials", async () => {
    const user = await resolve(credentialSource({}), anonymousRequest());

    expect(user).toBeNull();
  });
});

describe("Git admin allowlist", () => {
  it("matches case-insensitively and tolerates whitespace", () => {
    expect(isAllowedEmail(" Tom@Example.com ", ["tom@example.com"])).toBe(true);
    expect(isAllowedEmail("mallory@example.com", ["tom@example.com"])).toBe(false);
  });

  it("rejects everyone when the allowlist is empty", () => {
    expect(isAllowedEmail("tom@example.com", [])).toBe(false);
  });
});

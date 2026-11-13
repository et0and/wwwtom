import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { OAuthSessionError } from "@tom/types/errors";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const authMocks = vi.hoisted(() => ({ completeAuth: vi.fn() }));

// Only the provider exchange is stubbed: these tests cover the route's cookie
// and redirect contract, not the OAuth client. `initiateAuth` stays real.
vi.mock("../guestbook/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../guestbook/auth")>();
  return { ...original, completeAuth: authMocks.completeAuth };
});

const env = testEnv({
  ADAPTER_URL: "https://adapter.tom.so",
  GUESTBOOK_RETURN_URL: "https://tom.so/guestbook",
});

/** A stale identity cookie the retired flow left in the browser. */
const staleUserCookie = encodeURIComponent(
  JSON.stringify({ username: "tom", instance: "mastodon.social" }),
);

const callbackRequest = (query: string) =>
  requestWithEnv(`http://localhost/guestbook/callback${query}`, env, {
    headers: { Cookie: `guestbook_session=pending-token; guestbook_user=${staleUserCookie}` },
  });

const completedAuth = {
  user: {
    username: "tom",
    instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
  },
  sessionToken: "fresh-session-token",
};

describe("GET /guestbook/callback", () => {
  it("replaces the pending cookie with the new session and clears the retired identity cookie", async () => {
    authMocks.completeAuth.mockReturnValue(Effect.succeed(completedAuth));

    const response = await app.fetch(callbackRequest("?code=code-1&state=expected-state"));

    expect(authMocks.completeAuth).toHaveBeenCalledWith({
      code: "code-1",
      state: "expected-state",
      session_token: "pending-token",
      redirectUri: "https://adapter.tom.so/guestbook/callback",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://tom.so/guestbook");

    const cookies = response.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith("guestbook_session="));
    expect(session).toContain("guestbook_session=fresh-session-token");
    expect(session).toContain("Max-Age=2592000");
    expect(session).toContain("HttpOnly");
    const clearedUser = cookies.find((cookie) => cookie.startsWith("guestbook_user="));
    expect(clearedUser).toBeDefined();
    expect(clearedUser).toContain("Max-Age=0");

    // The provider token never reaches the browser: the redirect has no body
    // and no header or cookie carries an access token.
    expect(await response.text()).toBe("");
    const exposed = [...cookies, ...Array.from(response.headers.entries()).flat()].join("\n");
    expect(exposed).not.toContain("access_token");
  });

  it("redirects with an error and keeps the existing cookie on a state mismatch", async () => {
    authMocks.completeAuth.mockReturnValue(
      Effect.fail(
        new OAuthSessionError({
          message: "Invalid OAuth state",
          sessionToken: "pending-token",
        }),
      ),
    );

    const response = await app.fetch(callbackRequest("?code=code-1&state=attacker-state"));

    expect(authMocks.completeAuth).toHaveBeenCalledWith(
      expect.objectContaining({ state: "attacker-state", session_token: "pending-token" }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://tom.so/guestbook?error=auth_failed");

    const cookies = response.headers.getSetCookie();
    // A stray callback link must not replace or clear a signed-in session.
    expect(cookies.some((cookie) => cookie.startsWith("guestbook_session="))).toBe(false);
    expect(cookies.join("\n")).not.toContain("fresh-session-token");
  });
});

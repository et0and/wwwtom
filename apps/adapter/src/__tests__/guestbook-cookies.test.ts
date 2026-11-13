import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

/** A complete, well-formed identity the old flow would have trusted. */
const forgedIdentity = encodeURIComponent(
  JSON.stringify({
    username: "tom",
    instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
  }),
);

describe("guestbook cookie handling", () => {
  describe("GET /guestbook/me", () => {
    it("does not trust a forgeable guestbook_user cookie", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", env, {
          headers: { Cookie: `guestbook_user=${forgedIdentity}` },
        }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toBeNull();
    });

    it("does not trust a guestbook_user cookie that carries an access token", async () => {
      const withToken = {
        username: "tom",
        instance: "mastodon.social",
        display_name: "Tom",
        avatar_url: "https://mastodon.social/avatar.png",
        access_token: "stolen",
      };
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", env, {
          headers: { Cookie: `guestbook_user=${encodeURIComponent(JSON.stringify(withToken))}` },
        }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toBeNull();
    });

    it("returns JSON null when no session cookie is present", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/guestbook/me", env));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toBeNull();
    });

    it("returns JSON null when the session cookie is empty", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", env, {
          headers: { Cookie: "guestbook_session=" },
        }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toBeNull();
    });

    it("serves a signed-out read without a configured database", async () => {
      // The public page asks /me on every load. With no session there is
      // nothing to look up, so a missing DATABASE_URL must not turn the
      // signed-out read into a 500.
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", testEnv({ DATABASE_URL: "" })),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toBeNull();
    });
  });

  describe("POST /guestbook/logout", () => {
    it("clears both guestbook cookies", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/logout", env, {
          method: "POST",
          headers: { Cookie: `guestbook_user=${forgedIdentity}; guestbook_session=` },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      const setCookies = response.headers.getSetCookie();
      const cleared = setCookies
        .map((cookie) => cookie.split(";")[0])
        .filter((cookie) => cookie.includes("="));
      expect(cleared).toEqual(expect.arrayContaining(["guestbook_user=", "guestbook_session="]));
    });
  });
});

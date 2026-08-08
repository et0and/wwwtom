import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

const userCookie = encodeURIComponent(
  JSON.stringify({
    username: "tom",
    instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
    access_token: "token",
  }),
);

describe("guestbook cookie handling", () => {
  describe("GET /guestbook/me", () => {
    it("returns the user from the guestbook_user cookie", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", env, {
          headers: { Cookie: `guestbook_user=${userCookie}` },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        username: "tom",
        instance: "mastodon.social",
        display_name: "Tom",
        avatar_url: "https://mastodon.social/avatar.png",
        access_token: "token",
      });
    });

    it("returns the user from a raw (unencoded) JSON cookie", async () => {
      const rawUser = JSON.stringify({
        username: "tom",
        instance: "mastodon.social",
        display_name: "Tom",
        avatar_url: "https://mastodon.social/avatar.png",
        access_token: "token",
      });
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", env, {
          headers: { Cookie: `guestbook_user=${rawUser}` },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        username: "tom",
        instance: "mastodon.social",
        display_name: "Tom",
        avatar_url: "https://mastodon.social/avatar.png",
        access_token: "token",
      });
    });

    it("returns an empty body when no guestbook_user cookie is present", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/guestbook/me", env));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });

    it("returns an empty body when the cookie is not valid user JSON", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/me", env, {
          headers: { Cookie: "guestbook_user=not-json" },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });
  });

  describe("POST /guestbook/logout", () => {
    it("clears the guestbook cookies", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/guestbook/logout", env, {
          method: "POST",
          headers: { Cookie: `guestbook_user=${userCookie}; guestbook_session=sess` },
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

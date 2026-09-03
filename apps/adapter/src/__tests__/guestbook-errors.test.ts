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

const signedInRequest = (url: string, init: RequestInit = {}) =>
  requestWithEnv(url, env, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `guestbook_user=${userCookie}`,
      ...init.headers,
    },
  });

const postJson = (url: string, body: Record<string, string>) =>
  signedInRequest(url, { method: "POST", body: JSON.stringify(body) });

describe("guestbook flow error mapping", () => {
  it("maps a profanity failure to a 400 validation problem", async () => {
    const response = await app.fetch(
      postJson("http://localhost/guestbook/sign", { message: "fuck" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Your message contains profanity. Please keep it clean!",
      instance: "http://localhost/guestbook/sign",
    });
  });

  it("maps a missing sign message to a 400 validation problem naming the field", async () => {
    const response = await app.fetch(postJson("http://localhost/guestbook/sign", { message: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Missing required field: message",
      instance: "http://localhost/guestbook/sign",
    });
  });

  it("maps an invalid fediverse handle to a 400 validation problem", async () => {
    const response = await app.fetch(
      postJson("http://localhost/guestbook/auth/initiate", { handle: "not-a-handle" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Invalid fediverse handle format. Use: user@instance.social (without the leading @)",
      instance: "http://localhost/guestbook/auth/initiate",
    });
  });

  it("maps a missing handle to a 400 validation problem", async () => {
    const response = await app.fetch(
      postJson("http://localhost/guestbook/auth/initiate", { handle: "" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Missing field: handle",
      instance: "http://localhost/guestbook/auth/initiate",
    });
  });

  it("rejects a sign without a signed-in user as 401 unauthorized", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/guestbook/sign", env, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/unauthorized",
      status: 401,
      title: "Not authenticated",
      instance: "http://localhost/guestbook/sign",
    });
  });
});

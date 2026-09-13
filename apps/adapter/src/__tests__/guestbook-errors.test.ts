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

const expectValidationProblem = async (
  path: string,
  body: Record<string, string>,
  title: string,
): Promise<void> => {
  const response = await app.fetch(postJson(`http://localhost${path}`, body));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    type: "https://errors.tom.so/validation",
    status: 400,
    title,
    instance: `http://localhost${path}`,
  });
};

const PROFANITY_TITLE = "Your message contains profanity. Please keep it clean!";
const HANDLE_TITLE =
  "Invalid fediverse handle format. Use: user@instance.social (without the leading @)";

describe("guestbook flow error mapping", () => {
  it.each([
    { label: "plain", message: "fuck" },
    { label: "mixed in", message: "well fuck!" },
  ])("maps $label profanity to a 400 validation problem", async ({ message }) => {
    await expectValidationProblem("/guestbook/sign", { message }, PROFANITY_TITLE);
  });

  it.each(["not-a-handle", "a@b@c", "tom@"])(
    "rejects handle %s with a 400 validation problem",
    async (handle) => {
      await expectValidationProblem("/guestbook/auth/initiate", { handle }, HANDLE_TITLE);
    },
  );

  it.each([
    ["/guestbook/sign", { message: "" }, "Missing required field: message"],
    ["/guestbook/auth/initiate", { handle: "" }, "Missing field: handle"],
  ])("maps a missing field on %s to a 400 problem", async (path, body, title) => {
    await expectValidationProblem(path, body, title);
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

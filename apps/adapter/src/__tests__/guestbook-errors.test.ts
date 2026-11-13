import { describe, expect, it } from "vitest";
import { GuestbookConflictError } from "@tom/types/errors";
import { app } from "../index";
import { guestbookMessage, guestbookStatus } from "../guestbook/shared";
import { requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

/**
 * A non-empty session token is enough to reach message validation: the
 * profanity check runs before the session row is read, so these cases never
 * touch the database. A clean message still needs a real row and is covered
 * by the session tests.
 */
const signedInRequest = (url: string, init: RequestInit = {}) =>
  requestWithEnv(url, env, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: "guestbook_session=test-session",
      ...init.headers,
    },
  });

const postJson = (url: string, body: Record<string, string>) =>
  signedInRequest(url, { method: "POST", body: JSON.stringify(body) });

const expectValidationProblem = async (
  path: string,
  body: Record<string, string>,
  title: string,
  errors?: ReadonlyArray<{ detail: string; pointer: string }>,
): Promise<void> => {
  const response = await app.fetch(postJson(`http://localhost${path}`, body));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    type: "https://errors.tom.so/validation",
    status: 400,
    title,
    instance: `http://localhost${path}`,
    ...(errors !== undefined && { errors }),
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
    ["/guestbook/sign", { message: "" }, "Validation error", "#/message"],
    ["/guestbook/auth/initiate", { handle: "" }, "Validation error", "#/handle"],
  ])("maps an empty field on %s to a 400 problem", async (path, body, title, pointer) => {
    await expectValidationProblem(path, body, title, [
      { detail: "Expected a value with a length of at least 1", pointer },
    ]);
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

  it("maps a duplicate signature to 409, not 400", () => {
    const conflict = new GuestbookConflictError({
      message: "You have already signed the guestbook",
    });
    expect(guestbookStatus(conflict)).toBe(409);
    expect(guestbookMessage(conflict)).toBe("You have already signed the guestbook");
  });
});

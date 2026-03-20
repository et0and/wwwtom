import { action, query, redirect } from "@solidjs/router";
import { Effect, Redacted } from "effect";
import { DatabaseService } from "@tom/db/service";
import * as auth from "~/libs/actions/guestbook/auth";
import { checkProfanity } from "@tom/utils";
import { getCookie, getEvent, setCookie } from "vinxi/http";
import { MissingFieldError, ProfanityError, AuthenticationError } from "@tom/types";
import { runEffect, runEffectWithDb, getServiceLayer, getServiceLayerWithDb } from "~/libs/runtime";

const SESSION_COOKIE = "guestbook_session";
const USER_COOKIE = "guestbook_user";

const getCookieValue = (cookieName: string) =>
  Effect.sync(() => {
    const event = getEvent();
    const value = getCookie(event, cookieName);
    return value ?? "";
  });

const setSessionCookie = (name: string, value: string, maxAge: number) =>
  Effect.sync(() => {
    const event = getEvent();
    const isProd = Redacted.make(import.meta.env.PROD.toString());
    setCookie(event, name, value, {
      httpOnly: true,
      secure: Redacted.value(isProd) === "true",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
  });

export const getEntries = query(async () => {
  "use server";
  const layer = getServiceLayerWithDb();
  return runEffectWithDb(
    Effect.gen(function* () {
      const db = yield* DatabaseService;
      yield* Effect.logInfo("guestbook:getEntries:start");
      const data = yield* db.getGuestbookEntries({ page: 1, page_size: 100 });
      yield* Effect.logInfo("guestbook:getEntries:success");
      return data.results;
    }),
    layer,
  );
}, "guestbook-entries");

export const getCurrentUser = query(async () => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:getCurrentUser:start");
      const userCookie = yield* getCookieValue(USER_COOKIE);
      if (!userCookie) return null;

      const user = JSON.parse(userCookie) as auth.FediverseUser;
      yield* Effect.logInfo("guestbook:getCurrentUser:success");
      return user;
    }),
    layer,
  );
}, "guestbook-current-user");

export const initiateAuthAction = action(async (formData: FormData) => {
  "use server";
  const layer = getServiceLayerWithDb();
  const authUrl = await runEffectWithDb(
    Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:initiateAuth:start");
      const handle = formData.get("handle")?.toString();
      if (!handle) {
        return yield* Effect.fail(new MissingFieldError({ field: "handle" }));
      }

      const result = yield* auth.initiateAuth(handle);

      yield* setSessionCookie(SESSION_COOKIE, result.sessionToken, 15 * 60);
      yield* Effect.logInfo("guestbook:initiateAuth:success");

      return result.authUrl;
    }),
    layer,
  );

  return redirect(authUrl);
}, "initiate-auth");

export const signGuestbookAction = action(async (formData: FormData) => {
  "use server";
  const layer = getServiceLayerWithDb();
  await runEffectWithDb(
    Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:sign:start");
      const message = formData.get("message")?.toString();
      if (!message) {
        return yield* Effect.fail(new MissingFieldError({ field: "message" }));
      }

      const profanityCheck = checkProfanity(message);
      if (profanityCheck.hasProfanity) {
        return yield* Effect.fail(
          new ProfanityError({
            message:
              profanityCheck.message ?? "Your message contains profanity. Please keep it clean!",
          }),
        );
      }

      const userCookie = yield* getCookieValue(USER_COOKIE);
      if (!userCookie) {
        return yield* Effect.fail(new AuthenticationError({ message: "Not authenticated" }));
      }

      const user = JSON.parse(userCookie) as auth.FediverseUser;

      yield* auth.signGuestbook({
        user,
        message,
      });
      yield* Effect.logInfo("guestbook:sign:success");
    }),
    layer,
  );

  return { success: true };
}, "sign-guestbook");

export const logoutAction = action(async () => {
  "use server";
  const layer = getServiceLayer();
  await runEffect(
    Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:logout:start");
      yield* setSessionCookie(USER_COOKIE, "", 0);
      yield* setSessionCookie(SESSION_COOKIE, "", 0);
      yield* Effect.logInfo("guestbook:logout:success");
    }),
    layer,
  );

  return redirect("/guestbook");
}, "logout");

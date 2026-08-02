import { Effect, Redacted } from "effect";
import { DatabaseService, type GuestbookEntry } from "@tom/db/service";
import * as auth from "~/libs/actions/guestbook/auth";
import { checkProfanity } from "@tom/utils";
import { getCookie, setCookie } from "@solidjs/start/http";
import { MissingFieldError, ProfanityError, AuthenticationError } from "@tom/types";
import { runEffect, runEffectWithDb, getServiceLayer, getServiceLayerWithDb, gen, genWithDb } from "~/libs/runtime";

const SESSION_COOKIE = "guestbook_session";
const USER_COOKIE = "guestbook_user";

const getCookieValue = (cookieName: string) =>
  Effect.sync(() => {
    const value = getCookie(cookieName);
    return value ?? "";
  });

const setSessionCookie = (name: string, value: string, maxAge: number) =>
  Effect.sync(() => {
    const isProd = Redacted.make(import.meta.env.PROD.toString());
    setCookie(name, value, {
      httpOnly: true,
      secure: Redacted.value(isProd) === "true",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
  });

export const getEntries = async (): Promise<readonly GuestbookEntry[]> => {
  "use server";
  const layer = getServiceLayerWithDb();
  return runEffectWithDb(
    genWithDb(function* () {
      yield* Effect.logInfo("guestbook:getEntries:start");
      const db = yield* DatabaseService;
      const data = yield* db.getGuestbookEntries({ page: 1, page_size: 100 });
      yield* Effect.logInfo("guestbook:getEntries:success");
      return data.results;
    }),
    layer,
  );
};

export const getCurrentUser = async () => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    gen(function* () {
      yield* Effect.logInfo("guestbook:getCurrentUser:start");
      const userCookie = yield* getCookieValue(USER_COOKIE);
      if (!userCookie) return null;

      const user = JSON.parse(userCookie) as auth.FediverseUser;
      yield* Effect.logInfo("guestbook:getCurrentUser:success");
      return user;
    }),
    layer,
  );
};

export const initiateAuthAction = async (handle: string) => {
  "use server";
  const layer = getServiceLayerWithDb();
  return runEffectWithDb(
    genWithDb(function* () {
      yield* Effect.logInfo("guestbook:initiateAuth:start");
      if (!handle) {
        return yield* new MissingFieldError({ field: "handle" });
      }

      const result = yield* auth.initiateAuth(handle);

      yield* setSessionCookie(SESSION_COOKIE, result.sessionToken, 15 * 60);
      yield* Effect.logInfo("guestbook:initiateAuth:success");

      return result.authUrl;
    }),
    layer,
  );
};

export const signGuestbookAction = async (message: string) => {
  "use server";
  const layer = getServiceLayerWithDb();
  await runEffectWithDb(
    genWithDb(function* () {
      yield* Effect.logInfo("guestbook:sign:start");
      if (!message) {
        return yield* new MissingFieldError({ field: "message" });
      }

      const profanityCheck = checkProfanity(message);
      if (profanityCheck.hasProfanity) {
        return yield* new ProfanityError({
          message:
            profanityCheck.message ?? "Your message contains profanity. Please keep it clean!",
        });
      }

      const userCookie = yield* getCookieValue(USER_COOKIE);
      if (!userCookie) {
        return yield* new AuthenticationError({ message: "Not authenticated" });
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
};

export const logoutAction = async () => {
  "use server";
  const layer = getServiceLayer();
  await runEffect(
    gen(function* () {
      yield* Effect.logInfo("guestbook:logout:start");
      yield* setSessionCookie(USER_COOKIE, "", 0);
      yield* setSessionCookie(SESSION_COOKIE, "", 0);
      yield* Effect.logInfo("guestbook:logout:success");
    }),
    layer,
  );
};

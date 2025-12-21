import { action, query, redirect } from "@solidjs/router";
import { Effect } from "effect";
import * as db from "~/libs/db/guestbook";
import * as auth from "~/libs/actions/guestbook/auth";
import { checkProfanity } from "~/libs/utils/profanity";
import { runServerEffect } from "~/libs/utils/logger";
import { getCookie, getEvent, setCookie } from "vinxi/http";
import {
	MissingFieldError,
	ProfanityError,
	AuthenticationError,
} from "~/libs/types/errors";

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
		setCookie(event, name, value, {
			httpOnly: true,
			secure: import.meta.env.PROD,
			sameSite: "lax",
			maxAge,
			path: "/",
		});
	});

export const getEntries = query(async () => {
	"use server";
	const data = await runServerEffect(
		db.getGuestbookEntries({ page: 1, page_size: 100 }),
	);
	return data.results;
}, "guestbook-entries");

export const getCurrentUser = query(async () => {
	"use server";
	const user = await runServerEffect(
		Effect.gen(function* () {
			const userCookie = yield* getCookieValue(USER_COOKIE);
			if (!userCookie) return null;

			return JSON.parse(userCookie) as auth.FediverseUser;
		}),
	);
	return user;
}, "guestbook-current-user");

export const initiateAuthAction = action(async (formData: FormData) => {
	"use server";
	const authUrl = await runServerEffect(
		Effect.gen(function* () {
			const handle = formData.get("handle")?.toString();
			if (!handle) {
				return yield* Effect.fail(new MissingFieldError({ field: "handle" }));
			}

			const result = yield* auth.initiateAuth(handle);

			yield* setSessionCookie(SESSION_COOKIE, result.sessionToken, 15 * 60);

			return result.authUrl;
		}),
	);

	return redirect(authUrl);
}, "initiate-auth");

export const signGuestbookAction = action(async (formData: FormData) => {
	"use server";
	await runServerEffect(
		Effect.gen(function* () {
			const message = formData.get("message")?.toString();
			if (!message) {
				return yield* Effect.fail(new MissingFieldError({ field: "message" }));
			}

			const profanityCheck = checkProfanity(message);
			if (profanityCheck.hasProfanity) {
				return yield* Effect.fail(
					new ProfanityError({
						message:
							profanityCheck.message ??
							"Your message contains profanity. Please keep it clean!",
					}),
				);
			}

			const userCookie = yield* getCookieValue(USER_COOKIE);
			if (!userCookie) {
				return yield* Effect.fail(
					new AuthenticationError({ message: "Not authenticated" }),
				);
			}

			const user = JSON.parse(userCookie) as auth.FediverseUser;

			yield* auth.signGuestbook({
				user,
				message,
			});
		}),
	);

	return { success: true };
}, "sign-guestbook");

export const logoutAction = action(async () => {
	"use server";
	await runServerEffect(
		Effect.gen(function* () {
			yield* setSessionCookie(USER_COOKIE, "", 0);
			yield* setSessionCookie(SESSION_COOKIE, "", 0);
		}),
	);

	return redirect("/guestbook");
}, "logout");

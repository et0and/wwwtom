import { type APIEvent } from "@solidjs/start/server";
import * as auth from "~/libs/actions/guestbook/auth";
import { runServerEffect } from "~/libs/utils/logger";

export async function GET(event: APIEvent) {
	const url = new URL(event.request.url);
	const code = url.searchParams.get("code");
	const sessionToken = event.request.headers
		.get("cookie")
		?.split("; ")
		.find((c) => c.startsWith("guestbook_session="))
		?.split("=")[1];

	if (!code || !sessionToken) {
		return new Response("Missing code or session", { status: 400 });
	}

	const user = await runServerEffect(
		auth.handleCallback({
			code,
			session_token: sessionToken,
		}),
	);

	const headers = new Headers({
		Location: "/guestbook",
		"Set-Cookie": [
			`guestbook_user=${JSON.stringify(user)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600${import.meta.env.PROD ? "; Secure" : ""}`,
			`guestbook_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${import.meta.env.PROD ? "; Secure" : ""}`,
		].join(", "),
	});

	return new Response(null, {
		status: 302,
		headers,
	});
}

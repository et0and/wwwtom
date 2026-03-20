import { type APIEvent } from "@solidjs/start/server";
import * as auth from "~/libs/actions/guestbook/auth";
import { runEffectWithDb, getServiceLayerWithDb } from "~/libs/runtime";
import { Effect, Redacted } from "effect";
import { HttpStatus } from "@tom/constants";

export async function GET(event: APIEvent) {
  const layer = getServiceLayerWithDb();
  const url = new URL(event.request.url);
  const code = url.searchParams.get("code");
  const sessionToken = event.request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("guestbook_session="))
    ?.split("=")[1];

  if (!code || !sessionToken) {
    return new Response("Missing code or session", {
      status: HttpStatus.BadRequest,
    });
  }

  const user = await runEffectWithDb(
    Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:callback:start");
      const result = yield* auth.handleCallback({
        code,
        session_token: sessionToken,
      });
      yield* Effect.logInfo("guestbook:callback:success");
      return result;
    }),
    layer,
  );

  const isProd = Redacted.make(import.meta.env.PROD.toString());
  const secureFlag = Redacted.value(isProd) === "true" ? "; Secure" : "";

  const headers = new Headers({
    Location: "/guestbook",
    "Set-Cookie": [
      `guestbook_user=${JSON.stringify(user)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600${secureFlag}`,
      `guestbook_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`,
    ].join(", "),
  });

  return new Response(null, {
    status: HttpStatus.Found,
    headers,
  });
}

import { Command, UiSchema } from "@effect/ui";
import { Effect, Schema } from "effect";

import { adapterUrl } from "./session";

export const SignInMessage = UiSchema.TaggedEnum({
  ClickedSignIn: {},
  Started: {},
  Failed: {},
});

const RedirectSchema = Schema.Struct({
  url: Schema.String,
  redirect: Schema.Boolean,
});

/** Reject an authorize URL outside github.com before navigating. */
const authorizeUrl = (url: string): Effect.Effect<string, string> =>
  Effect.gen(function* () {
    const parsed = Schema.decodeUnknownOption(Schema.URLFromString)(url);
    if (parsed._tag === "None") return yield* Effect.fail("invalid_authorize_url");
    const value = parsed.value;
    if (value.protocol !== "https:" || value.hostname !== "github.com") {
      return yield* Effect.fail("invalid_authorize_url");
    }
    return url;
  });

const startSignIn = (): Effect.Effect<string, string> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${adapterUrl()}/auth/sign-in/social`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "github",
          callbackURL: window.location.origin,
          disableRedirect: true,
        }),
      });
      if (!response.ok) return undefined;
      return await response.json();
    },
    catch: () => "sign_in_failed" as const,
  }).pipe(
    Effect.flatMap((json) => {
      const parsed = Schema.decodeUnknownOption(RedirectSchema)(json);
      return parsed._tag === "None"
        ? Effect.fail("invalid_sign_in_response")
        : authorizeUrl(parsed.value.url);
    }),
  );

export const SignIn = Command.make("SignIn", { args: {} }, () =>
  startSignIn().pipe(
    Effect.map((url) => {
      window.location.assign(url);
      return SignInMessage.Started();
    }),
    Effect.catch(() => Effect.succeed(SignInMessage.Failed())),
  ),
);

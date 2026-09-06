import { createSignal, onSettled } from "solid-js";
import { Effect, Schema } from "effect";
import type { CmsError } from "@tom/types/errors";
import { decodeResponse, requestJson, requestVoid, runClient } from "./api";

export const EditorSessionSchema = Schema.Struct({
  session: Schema.Struct({ id: Schema.String }),
  user: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    name: Schema.optional(Schema.NullOr(Schema.String)),
    image: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
export type EditorSession = typeof EditorSessionSchema.Type;

const SessionResponseSchema = Schema.NullOr(EditorSessionSchema);

/** Load the current session; null when signed out. */
export const loadSession = (): Effect.Effect<EditorSession | null, CmsError> =>
  requestJson("/auth/get-session", {}, "load_session").pipe(
    Effect.flatMap((json) => decodeResponse(SessionResponseSchema, json, "load_session")),
  );

/** Sign out, then let the caller reload the session. */
export const signOut = () =>
  requestVoid(
    "/auth/sign-out",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
    "sign_out",
  );

const SignInRedirectSchema = Schema.Struct({
  url: Schema.String,
  redirect: Schema.Boolean,
});

/** Editor origin for OAuth callbacks (overridable in tests). */
export const editorOrigin = (): string =>
  import.meta.env.VITE_EDITOR_ORIGIN ?? window.location.origin;

/**
 * Start GitHub OAuth: POST the provider, then navigate to the authorize
 * URL better-auth returns. The callback lands back on the editor origin,
 * which the API trusts for post-login redirects.
 */
export const startGithubSignIn = (): Effect.Effect<string, CmsError> =>
  requestJson(
    "/auth/sign-in/social",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "github",
        callbackURL: editorOrigin(),
        disableRedirect: true,
      }),
    },
    "sign_in",
  ).pipe(
    Effect.flatMap((json) => decodeResponse(SignInRedirectSchema, json, "sign_in")),
    Effect.map((result) => result.url),
  );

/** Session signal for the app shell: undefined while loading, null signed out. */
export const createSession = () => {
  const [session, setSession] = createSignal<EditorSession | null | undefined>(undefined);
  const fetchSession = (): void => {
    void runClient(
      loadSession().pipe(
        Effect.tap((current) => Effect.sync(() => setSession(current))),
        Effect.catch(() => Effect.sync(() => setSession(null))),
      ),
    );
  };
  onSettled(fetchSession);
  return { session, reloadSession: fetchSession };
};

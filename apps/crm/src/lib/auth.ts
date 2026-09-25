import { Effect, Schema } from "effect";
import { CmsError } from "@tom/types/errors";
import { requestJson, requestVoid } from "./api";

export const CrmSessionSchema = Schema.Struct({
  session: Schema.Struct({ id: Schema.String }),
  user: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    name: Schema.optional(Schema.NullOr(Schema.String)),
    image: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
export type CrmSession = typeof CrmSessionSchema.Type;

const SessionResponseSchema = Schema.NullOr(CrmSessionSchema);
const SignInRedirectSchema = Schema.Struct({
  url: Schema.String,
  redirect: Schema.Boolean,
});

export const callbackUrlFromLocation = (
  location: Pick<Location, "origin" | "pathname" | "search" | "hash">,
): string => `${location.origin}${location.pathname}${location.search}${location.hash}`;

export const crmCallbackUrl = (): string => {
  const configuredOrigin = import.meta.env.VITE_CRM_ORIGIN;
  return configuredOrigin ?? callbackUrlFromLocation(globalThis.location);
};

export const loadSession: Effect.Effect<CrmSession | null, CmsError> = requestJson(
  "/auth/get-session",
  {},
  SessionResponseSchema,
  "load_session",
);

export const signOut: Effect.Effect<void, CmsError> = requestVoid(
  "/auth/sign-out",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  },
  "sign_out",
);

const assertAuthorizeUrl = (url: string): Effect.Effect<string, CmsError> =>
  Effect.try({
    try: () => new URL(url),
    catch: () =>
      new CmsError({ message: "Invalid sign-in URL", status: 500, operation: "sign_in" }),
  }).pipe(
    Effect.flatMap((parsed) =>
      parsed.protocol === "https:" && parsed.hostname === "github.com"
        ? Effect.succeed(url)
        : Effect.fail(
            new CmsError({ message: "Invalid sign-in URL", status: 500, operation: "sign_in" }),
          ),
    ),
  );

export const startGitHubSignIn: Effect.Effect<string, CmsError> = requestJson(
  "/auth/sign-in/social",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "github",
      callbackURL: crmCallbackUrl(),
      disableRedirect: true,
    }),
  },
  SignInRedirectSchema,
  "sign_in",
).pipe(
  Effect.flatMap((result) => assertAuthorizeUrl(result.url)),
  Effect.map((result) => result),
);

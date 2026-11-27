import { Query } from "@effect/ui";
import { Effect, Option, Schema } from "effect";

export const SessionSchema = Schema.Struct({
  session: Schema.Struct({ id: Schema.String }),
  user: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    name: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});

export type SessionData = typeof SessionSchema.Type;

export const adapterUrl = (): string =>
  import.meta.env.VITE_ADAPTER_URL ??
  (import.meta.env.DEV ? "http://localhost:8788" : window.location.origin);

/** The adapter is the only session authority; cookies ride the credentialed hop. */
export class Session extends Query.Service<Session>()("Session", {
  args: {},
  success: Schema.NullOr(SessionSchema),
  error: Schema.String,
  staleTime: "1 minute",
}) {}

export const SessionLayer = Session.toLayer(() =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${adapterUrl()}/auth/get-session`, {
        credentials: "include",
      });
      if (!response.ok) return null;
      return await response.json();
    },
    catch: () => "session_check_failed" as const,
  }).pipe(
    Effect.flatMap((json) =>
      Option.match(Schema.decodeUnknownOption(Schema.NullOr(SessionSchema))(json), {
        onNone: () => Effect.fail("invalid_session_response" as const),
        onSome: (session) => Effect.succeed(session),
      }),
    ),
  ),
);

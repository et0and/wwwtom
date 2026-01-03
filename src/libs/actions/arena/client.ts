import { getRequestEvent } from "solid-js/web";
import { Effect, Redacted } from "effect";
import { ArenaClient } from "~/libs/services/arena";
import { ArenaConfigError, HttpError } from "~/libs/types/errors";
import { retryPolicy } from "~/libs/utils/retry";

export function getArenaClient(): Effect.Effect<ArenaClient, ArenaConfigError> {
  "use server";

  return Effect.gen(function* () {
    const event = getRequestEvent();
    const env = event?.nativeEvent.context.cloudflare?.env as { ARENA_TOKEN: string } | undefined;

    const tokenValue =
      env?.ARENA_TOKEN ||
      (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
      import.meta.env.ARENA_TOKEN;

    if (!tokenValue) {
      yield* Effect.logError("ARENA_TOKEN environment variable is not set");
      return yield* Effect.fail(
        new ArenaConfigError({
          message: "ARENA_TOKEN environment variable is not set",
        }),
      );
    }

    const token = Redacted.make(tokenValue);
    yield* Effect.logDebug("Initializing Arena client");
    return new ArenaClient({ token: Redacted.value(token) });
  });
}

export function fetchArena<T>(
  operation: (client: ArenaClient) => Effect.Effect<T, HttpError>,
  name: string,
): Effect.Effect<T, ArenaConfigError | HttpError> {
  "use server";

  return getArenaClient().pipe(
    Effect.flatMap((client) =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Arena operation: ${name}`);

        return yield* operation(client).pipe(Effect.retry(retryPolicy));
      }),
    ),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Arena operation failed after retries: ${name}`, error);
        return yield* Effect.fail(error);
      }),
    ),
  );
}

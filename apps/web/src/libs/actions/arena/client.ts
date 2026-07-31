import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { ArenaApi } from "@tom/arena";
import type { HttpError } from "@tom/types";
import { retryPolicy } from "@tom/utils";
import { type AllServices } from "~/libs/runtime";

export function fetchArena<T>(
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  name: string,
  mode: "auth" | "public" = "auth",
): Effect.Effect<T, HttpError, ArenaService> {
  "use server";

  const effect: Effect.Effect<T, HttpError, AllServices> = Effect.gen(function* () {
    const arena = yield* ArenaService;
    yield* Effect.logDebug(`Arena operation: ${name}`);
    const client = mode === "public" ? arena.publicClient : arena.client;

    return yield* operation(client).pipe(Effect.retry(retryPolicy));
  });

  return effect.pipe(
    Effect.catch(
      Effect.fn("fetchArenaErrorHandler")(function* (error: HttpError) {
        yield* Effect.logError(`Arena operation failed after retries: ${name}`, error);
        return yield* error;
      }),
    ),
  );
}

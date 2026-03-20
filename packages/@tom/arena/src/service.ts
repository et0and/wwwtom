import { Effect, Redacted } from "effect";
import { AppConfig } from "@tom/utils/services";
import { ArenaClient, type ArenaApi } from "./client";

export interface ArenaServiceShape {
  /**
   * Get the Arena API client configured with the token from AppConfig
   */
  readonly client: ArenaApi;
  readonly publicClient: ArenaApi;
}

export class ArenaService extends Effect.Service<ArenaService>()("ArenaService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const config = yield* AppConfig;
    const token = config.arenaToken ? Redacted.value(config.arenaToken) : null;

    const client = new ArenaClient({
      token,
    });
    const publicClient = new ArenaClient({ token: null });

    return { client, publicClient };
  }),
}) {}

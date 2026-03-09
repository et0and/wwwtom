import { Context, Effect, Layer, Redacted } from "effect";
import { AppConfig } from "@tom/utils/services";
import { ArenaClient, type ArenaApi } from "./client";

// =============================================================================
// ArenaService - Effect Service Pattern
// =============================================================================

export interface ArenaServiceShape {
  /**
   * Get the Arena API client configured with the token from AppConfig
   */
  readonly client: ArenaApi;
  readonly publicClient: ArenaApi;
}

export class ArenaService extends Context.Tag("ArenaService")<ArenaService, ArenaServiceShape>() {}

export const ArenaServiceLive = Layer.effect(
  ArenaService,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const token = config.arenaToken ? Redacted.value(config.arenaToken) : null;

    const client = new ArenaClient({
      token,
    });
    const publicClient = new ArenaClient({ token: null });

    return { client, publicClient };
  }),
);

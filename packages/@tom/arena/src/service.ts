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
}

export class ArenaService extends Context.Tag("ArenaService")<ArenaService, ArenaServiceShape>() {}

export const ArenaServiceLive = Layer.effect(
  ArenaService,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const token = Redacted.value(config.arenaToken);

    // Create the client with the token (null if not set)
    const client = new ArenaClient({
      token: token || null,
    });

    return { client };
  }),
);

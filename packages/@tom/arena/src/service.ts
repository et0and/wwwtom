import { Context, Effect, Layer, Redacted } from "effect";
import { AppConfig } from "@tom/utils/services/config";
import { ArenaClient, type ArenaApi } from "./client";

export interface ArenaServiceContract {
  /**
   * Get the Arena API client configured with the token from AppConfig
   */
  readonly client: ArenaApi;
  readonly publicClient: ArenaApi;
}

export class ArenaService extends Context.Service<ArenaService, ArenaServiceContract>()(
  "ArenaService",
) {
  static readonly Default = Layer.effect(
    ArenaService,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const token = config.arenaToken ? Redacted.value(config.arenaToken) : null;

      const client = new ArenaClient({
        token,
        baseUrl: config.arenaBaseUrl ?? "https://api.are.na",
      });
      const publicClient = new ArenaClient({
        token: null,
        baseUrl: config.arenaBaseUrl ?? "https://api.are.na",
      });

      return { client, publicClient };
    }),
  );
}

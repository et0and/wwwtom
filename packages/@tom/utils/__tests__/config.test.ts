import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { makeAppConfigLayer, readCloudflareEnv, resolveSecretValue } from "../src/services/config";
import { AppConfig } from "../src/services/config";
import { SecretsError } from "@tom/types/errors";

describe("resolveSecretValue", () => {
  it("resolves undefined to undefined", async () => {
    expect(await resolveSecretValue(undefined)).toBeUndefined();
  });

  it("resolves a plain string to itself", async () => {
    expect(await resolveSecretValue("plain-token")).toBe("plain-token");
  });

  it("resolves a binding via get()", async () => {
    const binding = { get: async () => "binding-token" };
    expect(await resolveSecretValue(binding)).toBe("binding-token");
  });
});

describe("readCloudflareEnv", () => {
  it("returns env as-is when TOM_SECRETS absent and no AXIOM_TOKEN", async () => {
    const env = await readCloudflareEnv({ PAYLOAD_URL: "https://payload.example" });
    expect(env.PAYLOAD_URL).toBe("https://payload.example");
    expect(env.AXIOM_TOKEN).toBeUndefined();
  });

  it("resolves AXIOM_TOKEN string when TOM_SECRETS absent", async () => {
    const env = await readCloudflareEnv({ AXIOM_TOKEN: "dev-token" });
    expect(env.AXIOM_TOKEN).toBe("dev-token");
  });

  it("resolves AXIOM_TOKEN binding when TOM_SECRETS absent", async () => {
    const env = await readCloudflareEnv({ AXIOM_TOKEN: { get: async () => "minted" } });
    expect(env.AXIOM_TOKEN).toBe("minted");
  });

  it("merges TOM_SECRETS bundle into env", async () => {
    const secrets = JSON.stringify({
      PAYLOAD_URL: "https://payload.from-secrets",
      TELEGRAM_BOT_TOKEN: "tg-token",
      TELEGRAM_CHAT_ID: "123",
      ARENA_TOKEN: "arena-token",
    });
    const env = await readCloudflareEnv({
      TOM_SECRETS: { get: async () => secrets },
      PAYLOAD_URL: "https://payload.fallback",
    });
    expect(env.PAYLOAD_URL).toBe("https://payload.from-secrets");
    expect(env.TELEGRAM_BOT_TOKEN).toBe("tg-token");
    expect(env.ARENA_TOKEN).toBe("arena-token");
  });

  it("prefers AXIOM_TOKEN binding over TOM_SECRETS bundle", async () => {
    const secrets = JSON.stringify({ PAYLOAD_URL: "https://payload.from-secrets" });
    const env = await readCloudflareEnv({
      TOM_SECRETS: { get: async () => secrets },
      AXIOM_TOKEN: { get: async () => "axiom-minted" },
    });
    expect(env.AXIOM_TOKEN).toBe("axiom-minted");
  });

  it("throws SecretsError when TOM_SECRETS is not valid JSON", async () => {
    await expect(
      readCloudflareEnv({ TOM_SECRETS: { get: async () => "not-json" } }),
    ).rejects.toThrow(SecretsError);
    await expect(
      readCloudflareEnv({ TOM_SECRETS: { get: async () => "not-json" } }),
    ).rejects.toThrow("TOM_SECRETS must be a JSON object of string values");
  });

  it("throws when TOM_SECRETS fails schema validation", async () => {
    await expect(
      readCloudflareEnv({ TOM_SECRETS: { get: async () => JSON.stringify({ ARENA_TOKEN: 123 }) } }),
    ).rejects.toThrow(SecretsError);
    await expect(
      readCloudflareEnv({ TOM_SECRETS: { get: async () => JSON.stringify({ ARENA_TOKEN: 123 }) } }),
    ).rejects.toThrow("TOM_SECRETS must be a JSON object of string values");
  });

  it("ignores TOM_SECRETS keys that are undefined", async () => {
    const env = await readCloudflareEnv({
      TOM_SECRETS: { get: async () => JSON.stringify({}) },
    });
    expect(env.PAYLOAD_URL).toBeUndefined();
  });

  it("filters TOM_SECRETS bundle to only known secretKeys", async () => {
    const env = await readCloudflareEnv({
      TOM_SECRETS: {
        get: async () =>
          JSON.stringify({
            PAYLOAD_URL: "https://payload.example",
            UNKNOWN_KEY: "should-be-ignored",
            ARENA_TOKEN: "arena123",
          }),
      },
    });
    expect(env.PAYLOAD_URL).toBe("https://payload.example");
    expect(env.ARENA_TOKEN).toBe("arena123");
    expect(Object.hasOwn(env, "UNKNOWN_KEY")).toBe(false);
  });

  it("preserves cause on SecretsError", async () => {
    try {
      await readCloudflareEnv({ TOM_SECRETS: { get: async () => "not-json" } });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SecretsError);
      const secretsError = error as InstanceType<typeof SecretsError>;
      expect(secretsError.cause).toBeDefined();
    }
  });
});

describe("AppConfig.Default", () => {
  it.effect("provides default values", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(Redacted.value(config.payloadUrl)).toBe("");
      expect(Redacted.value(config.databaseUrl)).toBe("");
      expect(config.arenaToken).toBeUndefined();
      expect(config.arenaBaseUrl).toBeUndefined();
      expect(config.telegramBotToken).toBeUndefined();
      expect(config.telegramChatId).toBeUndefined();
      expect(config.isDev).toBe(true);
    }).pipe(Effect.provide(AppConfig.Default)),
  );
});

describe("AppConfig.fromEnv", () => {
  it.effect("creates a layer from env via delegation", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(Redacted.value(config.payloadUrl)).toBe("https://payload.example");
      expect(config.isDev).toBe(false);
    }).pipe(
      Effect.provide(
        AppConfig.fromEnv({ PAYLOAD_URL: "https://payload.example", NODE_ENV: "production" }),
      ),
    ),
  );
});

describe("makeAppConfigLayer", () => {
  it.effect("parses PAYLOAD_URL and DATABASE_URL", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(Redacted.value(config.payloadUrl)).toBe("https://payload.example");
      expect(Redacted.value(config.databaseUrl)).toBe("postgres://db");
    }).pipe(
      Effect.provide(
        makeAppConfigLayer({
          PAYLOAD_URL: "https://payload.example",
          DATABASE_URL: "postgres://db",
        }),
      ),
    ),
  );

  it.effect("prefers HYPERDRIVE connectionString over DATABASE_URL", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(Redacted.value(config.databaseUrl)).toBe("postgres://hyperdrive");
    }).pipe(
      Effect.provide(
        makeAppConfigLayer({
          DATABASE_URL: "postgres://fallback",
          HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
        }),
      ),
    ),
  );

  it.effect("defaults payloadUrl and databaseUrl to empty string when absent", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(Redacted.value(config.payloadUrl)).toBe("");
      expect(Redacted.value(config.databaseUrl)).toBe("");
    }).pipe(Effect.provide(makeAppConfigLayer({}))),
  );

  it.effect("trims ARENA_TOKEN", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaToken ? Redacted.value(config.arenaToken) : undefined).toBe("token");
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_TOKEN: "  token  " }))),
  );

  it.effect("filters ARENA_TOKEN undefined string", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaToken).toBeUndefined();
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_TOKEN: "undefined" }))),
  );

  it.effect("filters ARENA_TOKEN null string case-insensitive", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaToken).toBeUndefined();
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_TOKEN: "NULL" }))),
  );

  it.effect("filters ARENA_TOKEN whitespace", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaToken).toBeUndefined();
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_TOKEN: "   " }))),
  );

  it.effect("filters ARENA_TOKEN empty", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaToken).toBeUndefined();
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_TOKEN: "" }))),
  );

  it.effect("parses arenaBaseUrl", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaBaseUrl).toBe("https://api.are.na");
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_API_URL: "https://api.are.na" }))),
  );

  it.effect("filters arenaBaseUrl null string", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.arenaBaseUrl).toBeUndefined();
    }).pipe(Effect.provide(makeAppConfigLayer({ ARENA_API_URL: "null" }))),
  );

  it.effect("handles telegram config with both values", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.telegramBotToken ? Redacted.value(config.telegramBotToken) : undefined).toBe(
        "tok",
      );
      expect(config.telegramChatId).toBe("123");
    }).pipe(
      Effect.provide(makeAppConfigLayer({ TELEGRAM_BOT_TOKEN: "tok", TELEGRAM_CHAT_ID: "123" })),
    ),
  );

  it.effect("handles telegram config with neither", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.telegramBotToken).toBeUndefined();
      expect(config.telegramChatId).toBeUndefined();
    }).pipe(Effect.provide(makeAppConfigLayer({}))),
  );

  it.effect("sets isDev false for production", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.isDev).toBe(false);
    }).pipe(Effect.provide(makeAppConfigLayer({ NODE_ENV: "production" }))),
  );

  it.effect("sets isDev true for development", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.isDev).toBe(true);
    }).pipe(Effect.provide(makeAppConfigLayer({ NODE_ENV: "development" }))),
  );

  it.effect("sets isDev true by default", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.isDev).toBe(true);
    }).pipe(Effect.provide(makeAppConfigLayer({}))),
  );
});

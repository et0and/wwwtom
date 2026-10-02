import { describe, expect, it } from "vitest";
import { Effect, Exit, Redacted } from "effect";
import { parseDatabaseUrl } from "../web.hyperdrive.ts";

const origin = (url: string) => Effect.runSync(parseDatabaseUrl(url));
const failure = (url: string) => Effect.runSyncExit(parseDatabaseUrl(url));

describe("parseDatabaseUrl", () => {
  it("reads host, database, user and password", () => {
    const parsed = origin("postgres://tom:p%40ss@db.internal/tom");
    expect(parsed.host).toBe("db.internal");
    expect(parsed.database).toBe("tom");
    expect(parsed.user).toBe("tom");
    expect(Redacted.value(parsed.password)).toBe("p@ss");
  });

  it("defaults a portless postgres URL to 5432", () => {
    expect(origin("postgres://db.internal/tom").port).toBe(5432);
    expect(origin("postgresql://db.internal/tom").port).toBe(5432);
  });

  it("defaults a portless mysql URL to 3306, not the postgres port", () => {
    expect(origin("mysql://db.internal/tom").port).toBe(3306);
  });

  it("honours an explicit port on any scheme", () => {
    expect(origin("postgres://db.internal:6543/tom").port).toBe(6543);
    expect(origin("mysql://db.internal:3307/tom").port).toBe(3307);
  });

  it("fails on an unsupported scheme", () => {
    const exit = failure("redis://db.internal/0");
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

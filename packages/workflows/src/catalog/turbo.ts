import type { Env } from "../model";
import { secret } from "./secrets";

/**
 * Turbo tasks defined in turbo.json. The list is closed so a misspelled task
 * name fails to compile.
 */
export const turboTasks = ["build", "dev", "lint", "typecheck", "test"] as const;

export type TurboTask = (typeof turboTasks)[number];

export const turboTask = (task: TurboTask): string => `pnpm turbo run ${task}`;

/**
 * Turbo remote cache credentials shared by every Turbo task. TURBO_API points
 * Turbo at the custom cache server; TURBO_TEAM must be set or remote caching
 * stays disabled. The token and signature key are repository secrets: the
 * signature key lets Turbo sign and verify every artifact so a leaked write
 * token cannot poison the cache.
 */
export const turboEnv = (): Env => ({
  TURBO_API: "https://turbo.infra.tom.so",
  TURBO_TOKEN: secret("TURBO_CACHE_TOKEN"),
  TURBO_TEAM: "wwwtom",
  TURBO_REMOTE_CACHE_SIGNATURE_KEY: secret("TURBO_CACHE_SIGNATURE_KEY"),
});

import type { Env } from "../model";

/**
 * Node's default heap is too small for the build-heavy steps (Storybook, Vite,
 * Turbo). GitHub Actions rejects `NODE_OPTIONS` written through `$GITHUB_ENV`,
 * so every workflow declares the ceiling at the top level instead.
 */
export const nodeHeapEnv = (): Env => ({
  NODE_OPTIONS: "--max-old-space-size=4096",
});

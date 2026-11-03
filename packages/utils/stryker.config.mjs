/**
 * Stryker's sandbox preprocessor calls `ts.parseConfigFileTextToJson`, which
 * TypeScript 7 (`@effect/tsgo`) no longer exports. Pointing at a file that does
 * not exist skips that preprocessor; Vitest does not read tsconfig to
 * transform test files.
 */
export default {
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  tsconfigFile: "tsconfig.stryker.json",
  // Pure modules with focused unit tests. Widen this list as suites grow.
  mutate: [
    "src/slug.ts",
    "src/date.ts",
    "src/profanity.ts",
    "src/retry.ts",
    "src/page.ts",
    "src/session.ts",
    "src/auth.ts",
    "src/queue.ts",
    "src/tiptap-html.ts",
  ],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: {
    fileName: "coverage/mutation/index.html",
  },
  jsonReporter: {
    fileName: "coverage/mutation/mutation.json",
  },
  thresholds: {
    high: 90,
    low: 80,
    break: 70,
  },
  incremental: true,
  incrementalFile: "coverage/mutation/incremental.json",
  tempDirName: ".stryker-tmp",
};

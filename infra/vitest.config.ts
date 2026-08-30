import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["gtm/__tests__/**/*.test.ts", "turbo/src/__tests__/**/*.test.ts"],
  },
});

import stylex from "@stylexjs/unplugin";
import { stylexOptions } from "@tom/ui/stylex.config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [stylex.vite(stylexOptions)],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});

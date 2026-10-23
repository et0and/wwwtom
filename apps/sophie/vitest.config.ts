/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { stylexOptions } from "@tom/ui/stylex.config";

export default defineConfig({
  // StyleX before solid(): its Babel transform also has to reach
  // `.stylex.ts` token files, which vite-plugin-solid skips (no JSX).
  plugins: [stylex.vite(stylexOptions), solid()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    conditions: ["development", "browser"],
  },
});

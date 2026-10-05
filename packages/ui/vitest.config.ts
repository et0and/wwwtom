/// <reference types="vitest/config" />
import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";
import { stylexOptions } from "./stylex.config";

export default defineConfig({
  // StyleX before solid(): its Babel transform also has to reach `.stylex.ts`
  // token files, which vite-plugin-solid skips (no JSX).
  plugins: [stylex.vite(stylexOptions), solid()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});

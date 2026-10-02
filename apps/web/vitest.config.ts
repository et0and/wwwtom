/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { stylexOptions } from "@tom/ui/stylex.config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
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
      alias: {
        "~/": new URL("./src/", import.meta.url).pathname,
      },
    },
    define: {
      "import.meta.env.DEV": true,
      "import.meta.env.PROD": false,
      "process.env.ARENA_TOKEN": JSON.stringify(env.ARENA_TOKEN),
      "import.meta.env.ARENA_TOKEN": JSON.stringify(env.ARENA_TOKEN),
    },
  };
});

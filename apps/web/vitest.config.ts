/// <reference types="vitest" />
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [solid()],
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true,
      transformMode: {
        web: [/\.[jt]sx?$/],
      },
      deps: {
        optimizer: {
          web: {
            include: ["solid-js/web", "solid-js"],
          },
        },
      },
    },
    resolve: {
      conditions: ["development", "browser"],
      alias: {
        // Resolved from cwd (not import.meta.url, which Vite rewrites to the
        // original config location) so tools that run against a copied
        // sandbox — Stryker mutation testing — still resolve into their copy.
        "~/": `${resolve(process.cwd(), "src")}/`,
      },
    },
    define: {
      DEV: true,
      "import.meta.env.DEV": true,
      "import.meta.env.PROD": false,
      "import.meta.env.SSR": false,
      "process.env.ARENA_TOKEN": JSON.stringify(env.ARENA_TOKEN),
      "import.meta.env.ARENA_TOKEN": JSON.stringify(env.ARENA_TOKEN),
    },
  };
});

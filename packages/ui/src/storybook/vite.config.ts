/// <reference types="vitest/config" />
import path from "path";
import { fileURLToPath } from "url";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Solid v2 JSX transform (client-only; SSR/start mode is app-owned).
    // Providing a plugin named "solid" also stops the storybook-solidjs-vite
    // preset from adding its Solid v1 compiler (vite-plugin-solid v2),
    // whose output imports the v1-only `solid-js/web` subpath.
    solid(),
    tailwindcss(),
  ],
  define: {
    "process.env": {},
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});

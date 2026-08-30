import { existsSync } from "node:fs";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

export default defineConfig(({ command }) => {
  if (command === "serve" && existsSync(".dev.vars")) {
    process.loadEnvFile(".dev.vars");
  }

  return {
    plugins: [
      // Start mode replaces SolidStart: it owns entries, dev SSR serving,
      // and the production build (dist/client + dist/server). SSR via
      // @solidjs/web; providers adopt the `ssr` environment. The middleware
      // fronts pages AND non-HTML endpoints (/feed.xml, /sitemap.xml,
      // /robots.txt) plus decorates the request event for logging.
      solid({ start: { middleware: "./src/middleware.ts" }, ssr: true }),
      tailwindcss(),
    ],
    resolve: {
      // tsconfig `paths` resolve in the client build, but the dev SSR
      // runner needs a real module specifier — declare it here for all
      // environments.
      alias: {
        "~/": new URL("./src/", import.meta.url).pathname,
      },
    },
  };
});

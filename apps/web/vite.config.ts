import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

/** Best-effort git read so local builds still stamp a version and hash. */
const readGit = (args: string[], fallback: string): string => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) return fallback;
  return result.stdout.trim();
};

// The deploy runs from a checkout of the commit being shipped, so GITHUB_SHA is
// the deployed revision; local builds fall back to HEAD.
const commitHash =
  process.env.GITHUB_SHA?.slice(0, 7) ?? readGit(["rev-parse", "--short", "HEAD"], "unknown");
// Semantic-release tags `dev`, so the nearest tag is the last released version.
const appVersion = readGit(["describe", "--tags", "--abbrev=0"], "v0.0.0").replace(/^v/, "");

export default defineConfig(({ command }) => {
  if (command === "serve" && existsSync(".dev.vars")) {
    process.loadEnvFile(".dev.vars");
  }

  return {
    // Stamped into the client and SSR bundles so the footer shows the
    // deployed version without any runtime fetch.
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(commitHash),
    },
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

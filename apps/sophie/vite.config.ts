import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { stylexOptions } from "@tom/ui/stylex.config";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

export default defineConfig({
  plugins: [
    // Start mode replaces SolidStart: it owns entries, dev SSR serving,
    // and the production build (dist/client + dist/server). Same shape as
    // apps/web so per-route meta tags render server-side for crawlers.
    // StyleX before solid() so its Babel transform reaches `.stylex.ts` tokens.
    stylex.vite(stylexOptions),
    solid({ start: { middleware: "./src/middleware.ts" }, ssr: true }),
  ],
});

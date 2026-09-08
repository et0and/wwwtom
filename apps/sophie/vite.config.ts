import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

export default defineConfig({
  plugins: [
    // Start mode replaces SolidStart: it owns entries, dev SSR serving,
    // and the production build (dist/client + dist/server). Same shape as
    // apps/web so per-route meta tags render server-side for crawlers.
    solid({ start: { middleware: "./src/middleware.ts" }, ssr: true }),
    tailwindcss(),
  ],
});

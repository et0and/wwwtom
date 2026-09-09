import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

// Client-only Solid SPA (no SSR): all puzzle state stays in localStorage.
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 5180,
  },
});

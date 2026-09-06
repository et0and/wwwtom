import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

// Client-only Solid SPA (no SSR): the editor talks to the adapter API from
// the browser with session cookies, so VITE_ADAPTER_URL is inlined at build.
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 5173,
  },
});

import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { stylexOptions } from "@tom/ui/stylex.config";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

// Client-only Solid SPA (no SSR): the editor talks to the adapter API from
// the browser with session cookies, so VITE_ADAPTER_URL is inlined at build.
export default defineConfig({
  // StyleX before solid() so its Babel transform reaches `.stylex.ts` tokens.
  plugins: [stylex.vite(stylexOptions), solid()],
  server: {
    port: 5173,
  },
});

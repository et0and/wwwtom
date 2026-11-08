import { foldkit } from "@foldkit/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { stylexOptions } from "@tom/ui/stylex.config";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

export default defineConfig({
  plugins: [stylex.vite(stylexOptions), foldkit()],
  optimizeDeps: {
    entries: ["src/entry.ts"],
  },
  server: {
    port: 3002,
  },
});

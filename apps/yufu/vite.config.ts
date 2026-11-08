import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

export default defineConfig({
  plugins: [foldkit()],
  optimizeDeps: {
    entries: ["src/entry.ts"],
  },
  server: {
    port: 3002,
  },
});

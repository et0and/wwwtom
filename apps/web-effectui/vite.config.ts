import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: "src/client.ts",
      output: { entryFileNames: "assets/client.js" },
    },
  },
});

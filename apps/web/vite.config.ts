import mdx from "@mdx-js/rollup";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

if (process.cwd() !== import.meta.dirname) {
  process.chdir(import.meta.dirname);
}

export default defineConfig(({ command }) => {
  if (command === "serve") {
    process.loadEnvFile(".dev.vars");
  }

  return {
    plugins: [
      solidStart({ extensions: ["mdx", "md"], middleware: "./src/middleware.ts" }),
      tailwindcss(),
      mdx({
        jsxImportSource: "solid-js",
        providerImportSource: "solid-mdx",
      }),
    ],
    optimizeDeps: {
      exclude: ["@cf-wasm/photon"],
    },
    ssr: {
      external: ["@cf-wasm/photon"],
    },
    build: {
      rollupOptions: {
        external: ["@cf-wasm/photon"],
      },
    },
  };
});

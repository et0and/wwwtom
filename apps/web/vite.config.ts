import mdx from "@mdx-js/rollup";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  if (command === "serve") {
    process.loadEnvFile(".dev.vars");
  }

  return {
    plugins: [
      solidStart({ extensions: ["mdx", "md"] }),
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

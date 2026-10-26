import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://slate.tom.so",
  trailingSlash: "never",
  build: { assets: "_assets" },
});

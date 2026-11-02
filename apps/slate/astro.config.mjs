import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://slate.tom.so",
  trailingSlash: "never",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ja"],
    routing: { prefixDefaultLocale: false },
  },
  build: { assets: "_assets" },
});

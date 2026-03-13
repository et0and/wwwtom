import { defineConfig } from "@solidjs/start/config";
/* @ts-ignore */
import pkg from "@vinxi/plugin-mdx";
import tailwindcss from "@tailwindcss/vite";

const { default: mdx } = pkg;
export default defineConfig({
	extensions: ["mdx", "md"],
	server: {
		preset: "cloudflare-module",
		rollupConfig: {
			external: ["@cf-wasm/photon"],
		},
		// Nitro plugins directory
		plugins: ["~/plugins/nitro-isr.ts"],
		// ISR route rules for Cloudflare Workers
		// Uses custom plugin with KV storage for caching
		routeRules: {
			// Work pages - revalidated every 120 seconds in background
			"/work/**": {
				isr: 120,
			},
			// Blog posts - no ISR, always fresh
			"/posts/**": {
				isr: false,
			},
		},
	},
	vite: {
		plugins: [
			tailwindcss(),
			mdx.withImports({})({
				jsx: true,
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
	},
});

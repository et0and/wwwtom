/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		plugins: [solid()],
		test: {
			environment: "jsdom",
			setupFiles: ["./src/test/setup.ts"],
			globals: true,
			transformMode: {
				web: [/\.[jt]sx?$/],
			},
			deps: {
				optimizer: {
					web: {
						include: ["solid-js/web", "solid-js"],
					},
				},
			},
		},
		resolve: {
			conditions: ["development", "browser"],
			alias: {
				"~/": new URL("./src/", import.meta.url).pathname,
			},
		},
		define: {
			DEV: true,
			"import.meta.env.DEV": true,
			"import.meta.env.PROD": false,
			"import.meta.env.SSR": false,
			"process.env.ARENA_TOKEN": JSON.stringify(env.ARENA_TOKEN),
			"import.meta.env.ARENA_TOKEN": JSON.stringify(env.ARENA_TOKEN),
		},
	};
});

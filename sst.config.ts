// oxlint-disable-next-line triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: "wwwtom",
			removal: input?.stage === "production" ? "retain" : "remove",
			protect: ["production"].includes(input?.stage),
			home: "cloudflare",
			providers: {
				cloudflare: true,
			},
		};
	},
	async run() {
		const kv = new sst.cloudflare.Kv("RateLimitKv");

		const worker = new sst.cloudflare.Worker("Web", {
			handler: ".output/server/index.mjs",
			domain: "tom.so",
			link: [kv],
			assets: {
				directory: ".output/public",
			},
			environment: {
				NODE_ENV: "production",
			},
			build: {
				loader: {
					".wasm": "file",
				},
			},
			transform: {
				worker: (args) => {
					args.compatibilityDate = "2024-01-01";
					args.compatibilityFlags = ["nodejs_compat"];
					args.observability = {
						enabled: true,
						logs: {
							enabled: true,
							invocationLogs: true,
						},
					};
				},
			},
		});

		return {
			url: worker.url,
		};
	},
});

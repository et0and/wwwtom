/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
	app(input) {
		return {
			name: "wwwtom",
			removal: input?.stage === "production" ? "retain" : "remove",
			home: "aws",
			region: "ap-southeast-6",
			providers: { cloudflare: "6.8.0" },
		};
	},
	async run() {
		const vpc = new sst.aws.Vpc("TomVpc", { bastion: true });
		const cluster = new sst.aws.Cluster("TomCluster", { vpc });
		new sst.aws.Service("TomService", {
			cluster,
			scaling: {
				min: 2,
				max: 4, // Maximum number of instances
				cpuUtilization: 80,
			},
			capacity: $app.stage === "production" ? undefined : "spot",
			loadBalancer: {
				ports: [
					{ listen: "80/http", redirect: "443/https" },
					{ listen: "443/https", forward: "3000/http" },
				],
				domain: {
					name:
						$app.stage === "production"
							? "prod.tom.so"
							: $app.stage === "staging"
								? "staging.tom.so"
								: "development.tom.so",
					dns: sst.cloudflare.dns({
						zone: "d431d14124866e4d3fff6cdd5b727926",
					}),
				},
			},
			dev: {
				command: "npm run dev",
			},
		});
	},
});

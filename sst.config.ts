/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
	app(input) {
		return {
			name: "wwwtom",
			removal: input?.stage === "production" ? "retain" : "remove",
			home: "aws",
			region: "ap-southeast-2",
			providers: { cloudflare: "6.8.0" },
		};
	},
	async run() {
		const vpc = new sst.aws.Vpc("TomVpc", { bastion: false, nat: "instance" });
		const cluster = new sst.aws.Cluster("TomCluster", { vpc });
		new sst.aws.Service("TomService", {
			cluster,
			scaling: {
				min: 1,
				max: 2, // Maximum number of instances
				cpuUtilization: 100,
			},
			capacity: "spot",
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

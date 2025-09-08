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
				ports: [{ listen: "80/http", forward: "3000/http" }],
				domain: {
					name: "hackshaw-dev.tom.so",
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

/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: "wwwtom",
			removal: input?.stage === "production" ? "retain" : "remove",
			home: "aws",
			region: "ap-southeast-6",
		};
	},
	async run() {
		const vpc = new sst.aws.Vpc("TomVpc", { bastion: true });
		const cluster = new sst.aws.Cluster("TomCluster", { vpc });

		new sst.aws.Service("TomService", {
			cluster,
			loadBalancer: {
				ports: [{ listen: "80/http", forward: "3000/http" }],
			},
			dev: {
				command: "bun dev",
			},
		});
	},
});

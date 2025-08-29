/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: "wwwtom",
			removal: input?.stage === "production" ? "retain" : "remove",
			home: "aws",
			providers: {
				aws: {
					region: "ap-southeast-2",
				},
			},
		};
	},
	async run() {
		new sst.aws.SolidStart("wwwtom");
	},
});

export default ({ env }) => ({
	upload: {
		config: {
			provider: "aws-s3",
			providerOptions: {
				s3Options: {
					credentials: {
						accessKeyId: env("B2_APPLICATION_KEY_ID"),
						secretAccessKey: env("B2_APPLICATION_KEY"),
					},
					endpoint: env("B2_ENDPOINT"),
					region: env("B2_REGION"),
					params: {
						ACL: "public-read",
						Bucket: env("B2_BUCKET_NAME"),
					},
				},
				baseUrl: env("CDN_URL", "https://cdn.tom.so"),
				rootPath: env("B2_ROOT_PATH", "strapi"),
			},
			actionOptions: {
				upload: {
					ACL: "public-read",
				},
				uploadStream: {
					ACL: "public-read",
				},
				delete: {},
			},
		},
	},
});

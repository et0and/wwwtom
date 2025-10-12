export default {
	routes: [
		{
			method: "GET",
			path: "/posts",
			handler: "post.find",
			config: {
				policies: [],
			},
		},
		{
			method: "GET",
			path: "/posts/:documentId",
			handler: "post.findOne",
			config: {
				policies: [],
			},
		},
		{
			method: "POST",
			path: "/posts",
			handler: "post.create",
			config: {
				policies: [],
			},
		},
		{
			method: "PUT",
			path: "/posts/:documentId",
			handler: "post.update",
			config: {
				policies: [],
			},
		},
		{
			method: "DELETE",
			path: "/posts/:documentId",
			handler: "post.delete",
			config: {
				policies: [],
			},
		},
	],
};

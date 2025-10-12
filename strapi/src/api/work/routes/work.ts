export default {
	routes: [
		{
			method: "GET",
			path: "/works",
			handler: "work.find",
			config: {
				policies: [],
			},
		},
		{
			method: "GET",
			path: "/works/:documentId",
			handler: "work.findOne",
			config: {
				policies: [],
			},
		},
		{
			method: "POST",
			path: "/works",
			handler: "work.create",
			config: {
				policies: [],
			},
		},
		{
			method: "PUT",
			path: "/works/:documentId",
			handler: "work.update",
			config: {
				policies: [],
			},
		},
		{
			method: "DELETE",
			path: "/works/:documentId",
			handler: "work.delete",
			config: {
				policies: [],
			},
		},
	],
};

import { Effect } from "effect";
import { NodeinfoError } from "~/libs/types/errors";

const NODEINFO_10 = "http://nodeinfo.diaspora.software/ns/schema/1.0";
const NODEINFO_20 = "http://nodeinfo.diaspora.software/ns/schema/2.0";
const NODEINFO_21 = "http://nodeinfo.diaspora.software/ns/schema/2.1";

type Links = {
	links: Array<Link>;
};

type Link = {
	href: string;
	rel: string;
};

type Nodeinfo10 = {
	software: Software;
	metadata: Metadata;
};

type Nodeinfo20 = {
	software: Software;
	metadata: Metadata;
};

type Nodeinfo21 = {
	software: Software;
	metadata: Metadata;
};

type Software = {
	name: string;
};

type Metadata = {
	upstream?: {
		name: string;
	};
};

export type SNSType =
	| "mastodon"
	| "pleroma"
	| "friendica"
	| "firefish"
	| "gotosocial"
	| "pixelfed";

const detectFromNodeinfo = (
	software: Software,
	metadata: Metadata,
): Effect.Effect<SNSType, NodeinfoError> => {
	switch (software.name) {
		case "akkoma":
			return Effect.succeed("pleroma");
		case "firefish":
			return Effect.succeed("firefish");
		case "friendica":
			return Effect.succeed("friendica");
		case "gotosocial":
			return Effect.succeed("gotosocial");
		case "hometown":
			return Effect.succeed("mastodon");
		case "iceshrimp":
			return Effect.succeed("firefish");
		case "mastodon":
			return Effect.succeed("mastodon");
		case "pixelfed":
			return Effect.succeed("pixelfed");
		case "pleroma":
			return Effect.succeed("pleroma");
		case "sharkey":
			return Effect.succeed("mastodon");
		default:
			if (
				metadata.upstream?.name &&
				metadata.upstream.name.toLowerCase() === "mastodon"
			) {
				return Effect.succeed("mastodon");
			}
			return Effect.fail(new NodeinfoError({ message: "Unknown SNS" }));
	}
};

export const detector = (url: string): Effect.Effect<SNSType, NodeinfoError> =>
	Effect.gen(function* () {
		const res = yield* Effect.tryPromise({
			try: async () =>
				fetch(url + "/.well-known/nodeinfo", {
					signal: AbortSignal.timeout(20000),
				}),
			catch: (error) =>
				new NodeinfoError({
					message: "Failed to fetch nodeinfo endpoint",
					cause: error,
				}),
		});

		if (!res.ok) {
			return yield* Effect.fail(
				new NodeinfoError({
					message: `Failed to fetch nodeinfo: ${res.status} ${res.statusText}`,
				}),
			);
		}

		const data = (yield* Effect.tryPromise({
			try: async () => res.json(),
			catch: (error) =>
				new NodeinfoError({
					message: "Failed to parse nodeinfo response",
					cause: error,
				}),
		})) as Links;

		const link = data.links.find(
			(l) => l.rel === NODEINFO_20 || l.rel === NODEINFO_21,
		);

		if (!link) {
			return yield* Effect.fail(
				new NodeinfoError({ message: "Could not find nodeinfo" }),
			);
		}

		switch (link.rel) {
			case NODEINFO_10: {
				const res = yield* Effect.tryPromise({
					try: async () =>
						fetch(link.href, {
							signal: AbortSignal.timeout(20000),
						}),
					catch: (error) =>
						new NodeinfoError({
							message: "Failed to fetch nodeinfo 1.0 data",
							cause: error,
						}),
				});

				if (!res.ok) {
					return yield* Effect.fail(
						new NodeinfoError({
							message: `Failed to fetch nodeinfo data: ${res.status} ${res.statusText}`,
						}),
					);
				}

				const data = (yield* Effect.tryPromise({
					try: async () => res.json(),
					catch: (error) =>
						new NodeinfoError({
							message: "Failed to parse nodeinfo 1.0 data",
							cause: error,
						}),
				})) as Nodeinfo10;

				return yield* detectFromNodeinfo(data.software, data.metadata);
			}
			case NODEINFO_20: {
				const res = yield* Effect.tryPromise({
					try: async () =>
						fetch(link.href, {
							signal: AbortSignal.timeout(20000),
						}),
					catch: (error) =>
						new NodeinfoError({
							message: "Failed to fetch nodeinfo 2.0 data",
							cause: error,
						}),
				});

				if (!res.ok) {
					return yield* Effect.fail(
						new NodeinfoError({
							message: `Failed to fetch nodeinfo data: ${res.status} ${res.statusText}`,
						}),
					);
				}

				const data = (yield* Effect.tryPromise({
					try: async () => res.json(),
					catch: (error) =>
						new NodeinfoError({
							message: "Failed to parse nodeinfo 2.0 data",
							cause: error,
						}),
				})) as Nodeinfo20;

				return yield* detectFromNodeinfo(data.software, data.metadata);
			}
			case NODEINFO_21: {
				const res = yield* Effect.tryPromise({
					try: async () =>
						fetch(link.href, {
							signal: AbortSignal.timeout(20000),
						}),
					catch: (error) =>
						new NodeinfoError({
							message: "Failed to fetch nodeinfo 2.1 data",
							cause: error,
						}),
				});

				if (!res.ok) {
					return yield* Effect.fail(
						new NodeinfoError({
							message: `Failed to fetch nodeinfo data: ${res.status} ${res.statusText}`,
						}),
					);
				}

				const data = (yield* Effect.tryPromise({
					try: async () => res.json(),
					catch: (error) =>
						new NodeinfoError({
							message: "Failed to parse nodeinfo 2.1 data",
							cause: error,
						}),
				})) as Nodeinfo21;

				return yield* detectFromNodeinfo(data.software, data.metadata);
			}
			default:
				return yield* Effect.fail(
					new NodeinfoError({ message: "Could not find nodeinfo" }),
				);
		}
	});

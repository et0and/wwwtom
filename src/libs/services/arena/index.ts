// This was taken from https://github.com/e-e-e/arena-ts

import { Data, Effect } from "effect";
import {
	GetChannelsApiResponse,
	GetConnectionsApiResponse,
	MeApiResponse,
	PaginationAttributes,
	GetGroupApiResponse,
	GetGroupChannelsApiResponse,
	SearchApiResponse,
	GetBlockApiResponse,
	CreateBlockApiResponse,
	GetBlockChannelsApiResponse,
	CreateChannelApiResponse,
	GetChannelThumbApiResponse,
	GetChannelContentsApiResponse,
	ChannelConnectBlockApiResponse,
	ChannelConnectChannelApiResponse,
	GetUserChannelsApiResponse,
	GetUserApiResponse,
	GetUserFollowersApiResponse,
	GetUserFollowingApiResponse,
	GetBlockCommentApiResponse,
	CreateBlockCommentApiResponse,
} from "~/libs/types/arena";

/**
 * Structured HTTP error using Effect's Data module for proper equality and pattern matching
 */
export class HttpError extends Data.TaggedError("HttpError")<{
	readonly message: string;
	readonly status: number;
}> {}

export interface ArenaBlockApi {
	get(): Effect.Effect<GetBlockApiResponse, HttpError>;

	channels(
		options?: PaginationAttributes,
	): Effect.Effect<GetBlockChannelsApiResponse, HttpError>;

	update(data: {
		title?: string;
		description?: string;
		content?: string;
	}): Effect.Effect<void, HttpError>;

	comments(
		options?: PaginationAttributes,
	): Effect.Effect<GetBlockCommentApiResponse, HttpError>;

	addComment(
		comment: string,
	): Effect.Effect<CreateBlockCommentApiResponse, HttpError>;

	deleteComment(commentId: number): Effect.Effect<void, HttpError>;

	updateComment(
		commentId: number,
		comment: string,
	): Effect.Effect<void, HttpError>;
}

export interface ArenaUserApi {
	get(): Effect.Effect<GetUserApiResponse, HttpError>;

	channels(
		options?: PaginationAttributes,
	): Effect.Effect<GetUserChannelsApiResponse, HttpError>;

	following(): Effect.Effect<GetUserFollowingApiResponse, HttpError>;

	followers(): Effect.Effect<GetUserFollowersApiResponse, HttpError>;
}

export type ChannelStatus = "public" | "closed" | "private";

export interface ArenaGroupApi {
	get(): Effect.Effect<GetGroupApiResponse, HttpError>;

	channels(
		options?: PaginationAttributes,
	): Effect.Effect<GetGroupChannelsApiResponse, HttpError>;
}

export interface ArenaChannelApi {
	create(
		status?: ChannelStatus,
	): Effect.Effect<CreateChannelApiResponse, HttpError>;

	get(
		options?: PaginationAttributes,
	): Effect.Effect<GetChannelsApiResponse, HttpError>;

	delete(): Effect.Effect<void, HttpError>;

	update(data: {
		title: string;
		status?: ChannelStatus;
	}): Effect.Effect<void, HttpError>;

	thumb(): Effect.Effect<GetChannelThumbApiResponse, HttpError>;

	sort: {
		block(id: number, position: number): Effect.Effect<void, HttpError>;
		channel(id: number, position: number): Effect.Effect<void, HttpError>;
	};

	contents(
		options?: PaginationAttributes,
	): Effect.Effect<GetChannelContentsApiResponse, HttpError>;

	createBlock(data: {
		source?: string;
		content?: string;
		description?: string;
	}): Effect.Effect<CreateBlockApiResponse, HttpError>;

	connect: {
		block(id: number): Effect.Effect<ChannelConnectBlockApiResponse, HttpError>;
		channel(
			id: number,
		): Effect.Effect<ChannelConnectChannelApiResponse, HttpError>;
	};
	disconnect: {
		block(id: number): Effect.Effect<void, HttpError>;
		connection(id: number): Effect.Effect<void, HttpError>;
	};

	connections(
		options?: PaginationAttributes,
	): Effect.Effect<GetConnectionsApiResponse[], HttpError>;
}

export interface ArenaSearchApi {
	everything(
		query: string,
		options?: PaginationAttributes,
	): Effect.Effect<SearchApiResponse, HttpError>;

	users(
		query: string,
		options?: PaginationAttributes,
	): Effect.Effect<SearchApiResponse, HttpError>;

	channels(
		query: string,
		options?: PaginationAttributes,
	): Effect.Effect<SearchApiResponse, HttpError>;

	blocks(
		query: string,
		options?: PaginationAttributes,
	): Effect.Effect<SearchApiResponse, HttpError>;
}

export interface ArenaApi {
	/**
	 *  Fetch information about current authenticated user.
	 */
	me(): Effect.Effect<MeApiResponse, HttpError>;

	channels(
		options?: PaginationAttributes,
	): Effect.Effect<GetChannelsApiResponse, HttpError>;

	user(id: number | string): ArenaUserApi;

	group(slug: string): ArenaGroupApi;

	channel(slug: string): ArenaChannelApi;

	block(id: number): ArenaBlockApi;

	readonly search: ArenaSearchApi;
}

export type Fetch = (
	url: RequestInfo,
	init?: RequestInit & { cf?: { cacheTtl?: number; cacheKey?: string } },
) => Promise<Response>;
export type Date = { now(): number };

export class ArenaClient implements ArenaApi {
	private readonly domain = "https://api.are.na/v2/";
	private readonly headers: HeadersInit;
	private readonly fetch: Fetch;
	private readonly date: Date;

	private static defaultPaginationOptions: PaginationAttributes = {
		sort: "position",
		direction: "desc",
		per: 50,
	};

	constructor(config?: { token?: string | null; fetch?: Fetch; date?: Date }) {
		this.headers = {
			"Content-Type": "application/json",
			Authorization: config?.token ? `Bearer ${config.token}` : "",
		};
		this.fetch = config?.fetch || fetch.bind(globalThis);
		this.date = config?.date || Date;
	}

	me(): Effect.Effect<MeApiResponse, HttpError> {
		return this.getJson<MeApiResponse>("me");
	}

	channels(
		options?: PaginationAttributes,
	): Effect.Effect<GetChannelsApiResponse, HttpError> {
		return this.getJsonWithPaginationQuery("channels", options);
	}

	user(id: number | string): ArenaUserApi {
		return {
			get: (): Effect.Effect<GetUserApiResponse, HttpError> =>
				this.getJson(`users/${id}`),
			channels: (
				options?: PaginationAttributes,
			): Effect.Effect<GetUserChannelsApiResponse, HttpError> =>
				this.getJsonWithPaginationQuery(`users/${id}/channels`, options),
			following: (): Effect.Effect<GetUserFollowingApiResponse, HttpError> =>
				this.getJson(`users/${id}/following`),
			followers: (): Effect.Effect<GetUserFollowersApiResponse, HttpError> =>
				this.getJson(`users/${id}/followers`),
		};
	}

	group(slug: string): ArenaGroupApi {
		return {
			get: (): Effect.Effect<GetGroupApiResponse, HttpError> =>
				this.getJson(`groups/${slug}`),
			channels: (
				options?: PaginationAttributes,
			): Effect.Effect<GetGroupChannelsApiResponse, HttpError> =>
				this.getJsonWithPaginationQuery(`groups/${slug}/channels`, options),
		};
	}

	channel(slug: string): ArenaChannelApi {
		return {
			sort: {
				block: (id: number, position: number): Effect.Effect<void, HttpError> =>
					this.sortConnection(slug, id, position, "Block"),
				channel: (
					id: number,
					position: number,
				): Effect.Effect<void, HttpError> =>
					this.sortConnection(slug, id, position, "Channel"),
			},
			connect: {
				block: (
					blockId: number,
				): Effect.Effect<ChannelConnectBlockApiResponse, HttpError> =>
					this.createConnection<ChannelConnectBlockApiResponse>(
						slug,
						blockId,
						"Block",
					),
				channel: (
					channelId: number,
				): Effect.Effect<ChannelConnectChannelApiResponse, HttpError> =>
					this.createConnection<ChannelConnectChannelApiResponse>(
						slug,
						channelId,
						"Channel",
					),
			},
			disconnect: {
				block: (blockId: number): Effect.Effect<void, HttpError> =>
					this.del(`channels/${slug}/blocks/${blockId}`),
				connection: (connectionId: number): Effect.Effect<void, HttpError> =>
					this.del(`connections/${connectionId}`),
			},
			contents: (
				options?: PaginationAttributes,
			): Effect.Effect<GetChannelContentsApiResponse, HttpError> =>
				this.getJsonWithPaginationQuery(`channels/${slug}/contents`, options),
			connections: (
				options?: PaginationAttributes,
			): Effect.Effect<GetConnectionsApiResponse[], HttpError> =>
				this.getJsonWithPaginationQuery(
					`channels/${slug}/connections`,
					options,
				),
			create: (
				status?: ChannelStatus,
			): Effect.Effect<CreateChannelApiResponse, HttpError> =>
				this.postJson("channels", { title: slug, status }),
			update: (data: {
				title: string;
				status?: ChannelStatus;
			}): Effect.Effect<void, HttpError> =>
				this.putJson(`channels/${slug}`, data),
			createBlock: (data: {
				source?: string;
				content?: string;
				description?: string;
			}): Effect.Effect<CreateBlockApiResponse, HttpError> =>
				this.postJson(`channels/${slug}/blocks`, data),
			get: (
				options?: PaginationAttributes,
			): Effect.Effect<GetChannelsApiResponse, HttpError> =>
				this.getJsonWithPaginationQuery(`channels/${slug}`, options),
			delete: (): Effect.Effect<void, HttpError> =>
				this.del(`channels/${slug}`),
			thumb: (): Effect.Effect<GetChannelThumbApiResponse, HttpError> =>
				this.getJson(`channels/${slug}/thumb`),
		};
	}

	block(id: number): ArenaBlockApi {
		return {
			channels: (
				options?: PaginationAttributes,
			): Effect.Effect<GetBlockChannelsApiResponse, HttpError> =>
				this.getJsonWithPaginationQuery(`blocks/${id}/channels`, options),
			get: (): Effect.Effect<GetBlockApiResponse, HttpError> =>
				this.getJson(`blocks/${id}`),
			update: (data: {
				title?: string;
				description?: string;
				content?: string;
			}): Effect.Effect<void, HttpError> => this.putJson(`blocks/${id}`, data),
			comments: (
				options?: PaginationAttributes,
			): Effect.Effect<GetBlockCommentApiResponse, HttpError> =>
				this.getJsonWithPaginationQuery(`blocks/${id}/comments`, options),
			addComment: (
				body: string,
			): Effect.Effect<CreateBlockCommentApiResponse, HttpError> =>
				this.postJson(`blocks/${id}/comments`, { body }),
			deleteComment: (commentId: number): Effect.Effect<void, HttpError> =>
				this.del(`blocks/${id}/comments/${commentId}`),
			updateComment: (
				commentId: number,
				body: string,
			): Effect.Effect<void, HttpError> =>
				this.putJson(`blocks/${id}/comments/${commentId}`, { body }),
		};
	}

	get search(): ArenaSearchApi {
		return {
			everything: (
				query: string,
				options?: PaginationAttributes,
			): Effect.Effect<SearchApiResponse, HttpError> =>
				this.getJsonWithSearchAndPaginationQuery(`/search`, {
					q: query,
					...options,
				}),
			blocks: (
				query: string,
				options?: PaginationAttributes,
			): Effect.Effect<SearchApiResponse, HttpError> =>
				this.getJsonWithSearchAndPaginationQuery(`/search/blocks`, {
					q: query,
					...options,
				}),
			channels: (
				query: string,
				options?: PaginationAttributes,
			): Effect.Effect<SearchApiResponse, HttpError> =>
				this.getJsonWithSearchAndPaginationQuery(`/search/channels`, {
					q: query,
					...options,
				}),
			users: (
				query: string,
				options?: PaginationAttributes,
			): Effect.Effect<SearchApiResponse, HttpError> =>
				this.getJsonWithSearchAndPaginationQuery(`/search/users`, {
					q: query,
					...options,
				}),
		};
	}

	private createConnection<T>(
		channelSlug: string,
		id: number,
		type: "Block" | "Channel",
	): Effect.Effect<T, HttpError> {
		return this.postJson<T>(`channels/${channelSlug}/connections`, {
			connectable_type: type,
			connectable_id: id,
		});
	}

	private sortConnection(
		channelSlug: string,
		id: number,
		position: number,
		type: "Block" | "Channel",
	): Effect.Effect<void, HttpError> {
		return this.putJson(`channels/${channelSlug}/sort`, {
			connectable_type: type,
			connectable_id: id,
			new_position: position,
		});
	}

	private getJsonWithSearchAndPaginationQuery<T>(
		url: string,
		options?: PaginationAttributes & { q?: string },
	): Effect.Effect<T, HttpError> {
		const qs = this.paginationQueryString(options);
		const searchQuery =
			options && options.q ? `q=${options.q}${qs ? "&" : ""}` : "";
		return this.getJson<T>(`${url}?${searchQuery}${qs}`);
	}

	private getJsonWithPaginationQuery<T>(
		url: string,
		options?: PaginationAttributes,
	): Effect.Effect<T, HttpError> {
		const qs = this.paginationQueryString(options);
		return this.getJson<T>(`${url}?${qs}`);
	}

	private getJson<T>(endpoint: string): Effect.Effect<T, HttpError> {
		const url = `${this.domain}${endpoint}`;

		return Effect.gen(this, function* () {
			const response = yield* Effect.tryPromise({
				try: () =>
					this.fetch(url, {
						method: "GET",
						headers: {
							...this.headers,
							"Cache-Control": "public, max-age=86400",
						},
						cf: {
							cacheTtl: 86400,
							cacheKey: url,
						},
					}),
				catch: () =>
					new HttpError({ message: "Network request failed", status: 0 }),
			});

			if (!response.ok) {
				return yield* Effect.fail(
					new HttpError({
						message: response.statusText,
						status: response.status,
					}),
				);
			}

			const json = yield* Effect.tryPromise({
				try: () => response.json() as Promise<T>,
				catch: () =>
					new HttpError({
						message: "Failed to parse JSON response",
						status: 500,
					}),
			});

			return json;
		});
	}

	private putJson(
		endpoint: string,
		data?: unknown,
	): Effect.Effect<void, HttpError> {
		const url = `${this.domain}${endpoint}`;

		return Effect.gen(this, function* () {
			const response = yield* Effect.tryPromise({
				try: () =>
					this.fetch(url, {
						method: "PUT",
						headers: {
							...this.headers,
							"Cache-Control": "no-cache",
						},
						body: data ? JSON.stringify(data) : null,
						cf: {
							cacheTtl: 0,
						},
					}),
				catch: () =>
					new HttpError({ message: "Network request failed", status: 0 }),
			});

			if (!response.ok) {
				return yield* Effect.fail(
					new HttpError({
						message: response.statusText,
						status: response.status,
					}),
				);
			}
		});
	}

	private postJson<T>(
		endpoint: string,
		data?: unknown,
	): Effect.Effect<T, HttpError> {
		const url = `${this.domain}${endpoint}`;

		return Effect.gen(this, function* () {
			const response = yield* Effect.tryPromise({
				try: () =>
					this.fetch(url, {
						method: "POST",
						headers: {
							...this.headers,
							"Cache-Control": "no-cache",
						},
						body: data ? JSON.stringify(data) : null,
						cf: {
							cacheTtl: 0,
						},
					}),
				catch: () =>
					new HttpError({ message: "Network request failed", status: 0 }),
			});

			if (!response.ok) {
				return yield* Effect.fail(
					new HttpError({
						message: response.statusText,
						status: response.status,
					}),
				);
			}

			const json = yield* Effect.tryPromise({
				try: () => response.json() as Promise<T>,
				catch: () =>
					new HttpError({
						message: "Failed to parse JSON response",
						status: 500,
					}),
			});

			return json;
		});
	}

	private del(endpoint: string): Effect.Effect<void, HttpError> {
		const url = `${this.domain}${endpoint}`;

		return Effect.gen(this, function* () {
			const response = yield* Effect.tryPromise({
				try: () =>
					this.fetch(url, {
						method: "DELETE",
						headers: {
							...this.headers,
							"Cache-Control": "no-cache",
						},
						cf: {
							cacheTtl: 0,
						},
					}),
				catch: () =>
					new HttpError({ message: "Network request failed", status: 0 }),
			});

			if (!response.ok) {
				return yield* Effect.fail(
					new HttpError({
						message: response.statusText,
						status: response.status,
					}),
				);
			}
		});
	}

	private paginationQueryString(options?: PaginationAttributes) {
		const { page, per, sort, direction, forceRefresh } = {
			...ArenaClient.defaultPaginationOptions,
			...options,
		};
		const attrs = [];
		if (page) attrs.push(`page=${page}`);
		if (per) attrs.push(`per=${per}`);
		if (sort) attrs.push(`sort=${sort}`);
		if (direction) attrs.push(`direction=${direction}`);
		if (forceRefresh) attrs.push(`date=${this.date.now()}`);
		return attrs.join("&");
	}
}

import { Data } from "effect";

export class ImageError extends Data.TaggedError("ImageError")<{
	readonly response: Response;
	readonly cause?: unknown;
}> {}

export class ArenaConfigError extends Data.TaggedError("ArenaConfigError")<{
	readonly message: string;
}> {}

export class SearchError extends Data.TaggedError("SearchError")<{
	message: string;
}> {}

export class HttpError extends Data.TaggedError("HttpError")<{
	readonly message: string;
	readonly status: number;
}> {}

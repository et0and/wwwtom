export type PayloadContentNode = {
	type: string;
	format?: number | string;
	indent?: number | string;
	version?: number;
	children?: PayloadContentNode[];
	direction?: string | null;
	textStyle?: string;
	textFormat?: number;
	fields?: PayloadBlockFields;
	tag?: string;
	mode?: string;
	text?: string;
	style?: string;
	detail?: number;
	id?: string;
};

export type PayloadBlockFields = {
	id?: string;
	media?: PayloadMedia;
	blockName?: string;
	blockType?: string;
	content?: PayloadRichContent;
	style?: string;
	url?: string;
	newTab?: boolean;
	arenaSlug?: string;
	arenaTitle?: string;
};

export type PayloadRichContent = {
	root: PayloadContentNode;
};

export type PayloadMediaSize = {
	url: string | null;
	width: number | null;
	height: number | null;
	mimeType: string | null;
	filesize: number | null;
	filename: string | null;
};

export type PayloadMediaSizes = {
	thumbnail: PayloadMediaSize | null;
	square: PayloadMediaSize | null;
	small: PayloadMediaSize | null;
	medium: PayloadMediaSize | null;
	large: PayloadMediaSize | null;
	xlarge: PayloadMediaSize | null;
	og: PayloadMediaSize | null;
};

export type PayloadMedia = {
	id: number;
	alt: string | null;
	caption: PayloadRichContent | null;
	updatedAt: string;
	createdAt: string;
	url: string;
	thumbnailURL: string;
	filename: string;
	mimeType: string;
	filesize: number;
	width: number;
	height: number;
	focalX: number;
	focalY: number;
	sizes: PayloadMediaSizes;
};

export type PayloadPost = {
	id: number | string;
	title: string;
	summary?: string | null;
	publishedAt: string;
	slug: string;
	content?: string | PayloadRichContent;
	heroImage?: { url: string; alt?: string } | null;
	arenaSlug?: string | null;
	arenaTitle?: string | null;
	createdAt: string;
	updatedAt: string;
	meta?: {
		title?: string | null;
		description?: string | null;
		image?: string | null;
	};
};

export type PayloadResponse<T> = {
	docs: T;
	totalDocs: number;
	limit: number;
	page: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
};

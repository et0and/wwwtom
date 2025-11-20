export interface PayloadPost {
	id: string;
	title: string;
	summary?: string;
	publishedAt: string;
	slug: string;
	content?: string | PayloadRichContent;
	heroImage?: {
		url: string;
		alt?: string;
	};
	createdAt: string;
	updatedAt: string;
	meta?: {
		title?: string;
		description?: string;
		image?: string;
	};
}

export interface PayloadResponse<T> {
	docs: T;
	totalDocs: number;
	limit: number;
	page: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface PayloadMedia {
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
}

export interface PayloadMediaSizes {
	thumbnail: PayloadMediaSize | null;
	square: PayloadMediaSize | null;
	small: PayloadMediaSize | null;
	medium: PayloadMediaSize | null;
	large: PayloadMediaSize | null;
	xlarge: PayloadMediaSize | null;
	og: PayloadMediaSize | null;
}

export interface PayloadMediaSize {
	url: string | null;
	width: number | null;
	height: number | null;
	mimeType: string | null;
	filesize: number | null;
	filename: string | null;
}

export interface PayloadRichContent {
	root: PayloadContentNode;
}

export interface PayloadContentNode {
	type: string;
	format?: number;
	indent?: number;
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
}

export interface PayloadBlockFields {
	id?: string;
	media?: PayloadMedia;
	blockName?: string;
	blockType?: string;
	content?: PayloadRichContent;
	style?: string;
	url?: string;
	newTab?: boolean;
}

export interface PayloadLinkFields {
	url: string;
	newTab?: boolean;
}

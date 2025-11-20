export interface SearchParams {
	term: string;
	limit?: number;
	mode?: "fulltext" | "vector" | "hybrid";
}

export interface SearchDocument {
	id: string;
	title: string;
	slug?: string;
	content?: string;
	category: "Work" | "Posts";
	summary?: string;
}

export interface SearchHit {
	document: SearchDocument;
	score?: number;
}

export interface SearchResult {
	hits: SearchHit[];
	count: number;
	elapsed: number;
}

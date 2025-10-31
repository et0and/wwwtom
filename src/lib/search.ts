import { createSignal } from "solid-js";

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
	category: "Work" | "Post";
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

export function createSearch() {
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const search = async (params: SearchParams): Promise<SearchResult | null> => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(params),
			});

			const data = await response.json();
			return data;
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			setError(errorMsg);
			return null;
		} finally {
			setLoading(false);
		}
	};

	return { search, loading, error };
}

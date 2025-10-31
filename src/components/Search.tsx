import { createSignal, For, onCleanup, Show } from "solid-js";
import { A } from "@solidjs/router";
import { createSearch, SearchDocument, SearchHit } from "~/lib/search";

export default function Search() {
	const [query, setQuery] = createSignal("");
	const [results, setResults] = createSignal<SearchHit[]>([]);
	const { search, error } = createSearch();
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const performSearch = async (searchTerm: string): Promise<void> => {
		const data = await search({ term: searchTerm, limit: 5 });
		if (data) {
			const seen = new Set<string>();
			const deduplicated = data.hits.filter((hit: SearchHit) => {
				const identifier = hit.document.title
					.toLowerCase()
					.replaceAll(/\s+/g, "-");
				if (seen.has(identifier)) {
					return false;
				}
				seen.add(identifier);
				return true;
			});
			setResults(deduplicated);
		}
	};

	const handleSearch = async (e: Event): Promise<void> => {
		e.preventDefault();
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		await performSearch(query());
	};

	const handleInput = (e: Event): void => {
		const target = e.currentTarget as HTMLInputElement;
		const value = target.value;
		setQuery(value);

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (value.length === 0) {
			setResults([]);
			return;
		}

		if (value.length >= 4) {
			debounceTimer = setTimeout(() => {
				performSearch(value);
			}, 300);
		}
	};

	onCleanup(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});

	const getResultLink = (result: SearchHit): string | null => {
		const doc = result.document;

		const slug = doc.slug || doc.title.toLowerCase().replaceAll(/\s+/g, "-");

		// don't just return the homepage
		if (!slug || slug === "tom-hackshaw") {
			return null;
		}

		switch (doc.category) {
			case "Work":
				return `/work/${slug}`;
			case "Posts":
				return `/posts/${slug}`;
			default:
				return `/${slug}`;
		}
	};

	const getCategoryClass = (category: SearchDocument["category"]): string => {
		return category === "Work" ? "work" : category === "Posts" ? "post" : "";
	};

	const truncateContent = (content: string, maxLength = 50): string => {
		return content.length > maxLength
			? `${content.slice(0, maxLength)}...`
			: content;
	};

	return (
		<div>
			<div class="text-center">
				<form onSubmit={handleSearch}>
					<input
						type="text"
						value={query()}
						onInput={handleInput}
						placeholder="Search..."
						class="border p-2 mb-4 text-center"
					/>
				</form>

				<Show when={error()}>
					<p class="error">{error()}</p>
				</Show>
			</div>

			<div class="text-left">
				<For each={results()}>
					{(result) => {
						const link = getResultLink(result);
						return (
							<Show when={link}>
								{(validLink) => (
									<A href={validLink()} class="search-result">
										<p class="font-medium text-lg">
											{result.document.title}{" "}
											<span
												class={`search-category ${getCategoryClass(result.document.category)}`}
											>
												{result.document.category}
											</span>
										</p>
										<Show when={result.document.content}>
											{(content) => <p>{truncateContent(content())}</p>}
										</Show>
									</A>
								)}
							</Show>
						);
					}}
				</For>
			</div>
		</div>
	);
}

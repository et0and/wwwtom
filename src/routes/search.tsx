import Meta from "~/components/Meta";
import Search from "~/components/Search";

export default function SearchPage() {
	<Meta
		title="Search"
		metaType="description"
		metaContent="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
	/>;
	return (
		<main class="flex flex-col items-center justify-center p-8">
			<Search />
		</main>
	);
}

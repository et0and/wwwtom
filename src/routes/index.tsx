import Meta from "~/components/Meta";
import SlimeDish from "~/components/SlimeDish";

export default function Home() {
	return (
		<>
			<Meta
				title="Home"
				metaType="description"
				metaContent="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
			/>
			<main class="flex flex-col items-center justify-center p-8">
				<SlimeDish />
			</main>
		</>
	);
}

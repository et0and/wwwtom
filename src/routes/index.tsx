import Meta from "~/components/Meta";

export default function Home() {
	return (
		<>
			<Meta
				title="Home"
				metaType="description"
				metaContent="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
			/>
			<main class="text-center mx-auto p-4">
				<img
					src="https://cdn.tom.so/scribs.svg"
					class="w-full max-w-[500px] mx-auto"
					alt=""
				/>
			</main>
		</>
	);
}

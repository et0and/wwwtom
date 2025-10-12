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
					src="/api/image?url=https://cdn.tom.so/scribs.svg&width=450"
					class="w-full max-w-[500px] mx-auto"
				/>
			</main>
		</>
	);
}

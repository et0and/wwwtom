import { ArenaCarousel } from "~/components";
import { PageLayout } from "~/layouts";

export default function Home() {
	return (
		<>
			<PageLayout
				title="Home"
				description="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
			>
				<ArenaCarousel
					slug="i-could-go-anywhere-but-again-i-go-with-you-kg36margvic"
					title="I could go anywhere but again I go with you"
				/>
			</PageLayout>
		</>
	);
}

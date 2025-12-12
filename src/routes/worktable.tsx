import { ArenaCarousel } from "~/components/Arena";
import PageLayout from "~/components/PageLayout";

export default function Worktable() {
	return (
		<>
			<PageLayout
				title="Worktable"
				description="What I am currently working on or interested in"
			>
				<h1>Worktable</h1>
				<h2>What I am currently working on or interested in</h2>
				<ArenaCarousel slug="tom-s-worktable" title="Tom's worktable" />

				<p>
					At the moment I am focusing a lot on learning about data driven
					applications, as well as learning more about functional programming
					paradigms through libraries such as{" "}
					<a href="https://effect.website/">Effect</a>.
				</p>
			</PageLayout>
		</>
	);
}

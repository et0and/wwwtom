import { createAsync } from "@solidjs/router";
import { getWorks } from "~/lib/strapi";
import PageLayout from "~/components/PageLayout";

export default function WorkHome() {
	const works = createAsync(() => getWorks());

	return (
		<PageLayout title="Work" description="Some work that I have made">
			<h1>Work</h1>

			{works() ? (
				works()!.map((work) => (
					<a href={`/work/${work.slug}`}>
						<div>
							<h2>{work.title}</h2>
						</div>
					</a>
				))
			) : (
				<p>Loading...</p>
			)}
		</PageLayout>
	);
}

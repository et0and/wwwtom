import { createAsync } from "@solidjs/router";
import { getWorks } from "~/lib/strapi";
import PageLayout from "~/components/PageLayout";
import { Suspense } from "solid-js";
import Spinner from "~/components/Spinner";

export default function WorkHome() {
	const works = createAsync(() => getWorks());

	return (
		<PageLayout title="Work" description="Some work that I have made">
			<h1>Work</h1>
			<p>Some work that I have made.</p>
			<Suspense fallback={<Spinner color="grey" />}>
				{works() ? (
					works()!.map((work) => (
						<a href={`/work/${work.slug}`}>
							<h2>{work.title}</h2>
							<p>{work.summary}</p>
						</a>
					))
				) : (
					<p>Loading...</p>
				)}
			</Suspense>
		</PageLayout>
	);
}

import { Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getWorkBySlug } from "~/lib/api/payload";
import PageLayout from "~/components/PageLayout";
import Meta from "~/components/Meta";
import Spinner from "~/components/Spinner";

export const route = {
	preload: ({ params }) => getWorkBySlug(params.slug),
} satisfies RouteDefinition;

export default function WorkPage() {
	const params = useParams();
	const work = createAsync(() => getWorkBySlug(params.slug), {
		deferStream: true,
	});

	return (
		<>
			<Show when={work()} fallback={<Spinner color="grey" />}>
				{(data) => (
					<PageLayout
						title={data().title}
						description={data().summary || data().meta?.description}
					>
						<article>
							<h1>{data().title}</h1>
							<p>{data().summary}</p>
							<div innerHTML={data().content} />
						</article>
					</PageLayout>
				)}
			</Show>
		</>
	);
}

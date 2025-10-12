import { Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getWorkBySlug } from "~/lib/strapi";
import PageLayout from "~/components/PageLayout";

export const route = {
	preload: ({ params }) => getWorkBySlug(params.slug),
} satisfies RouteDefinition;

export default function WorkPage() {
	const params = useParams();
	const work = createAsync(() => getWorkBySlug(params.slug));

	return (
		<Show when={work()} fallback={<p>Loading...</p>}>
			{(data) => (
				<PageLayout title={data().title} description={data().summary}>
					<article>
						<h1>{data().title}</h1>
						<time>
							{new Date(
								data().publicationDate || data().publishedAt,
							).toLocaleDateString("en-NZ", {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</time>
						<p>{data().summary}</p>
						<div innerHTML={data().content} />
					</article>
				</PageLayout>
			)}
		</Show>
	);
}

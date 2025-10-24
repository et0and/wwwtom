import { Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getWorkBySlug } from "~/lib/api/strapi";
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

	const title = () => work()?.title || "";
	const summary = () => work()?.summary || "";

	return (
		<>
			<Meta title={title()} metaType="description" metaContent={summary()} />
			<Show when={work()} fallback={<Spinner color="grey" />}>
				{(data) => (
					<PageLayout>
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
		</>
	);
}

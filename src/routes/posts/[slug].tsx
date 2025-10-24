import { Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getPostBySlug } from "~/lib/api/strapi";
import PageLayout from "~/components/PageLayout";
import Spinner from "~/components/Spinner";

export const route = {
	preload: ({ params }) => getPostBySlug(params.slug),
} satisfies RouteDefinition;

export default function PostPage() {
	const params = useParams();
	const post = createAsync(() => getPostBySlug(params.slug), {
		deferStream: true,
	});

	return (
		<>
			<Show when={post()} fallback={<Spinner color="grey" />}>
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
							<div innerHTML={data().content} />
						</article>
					</PageLayout>
				)}
			</Show>
		</>
	);
}

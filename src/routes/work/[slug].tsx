import { Show, lazy, For } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getWorkBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";

import { Spinner } from "~/components";

const ArenaCarousel = lazy(() =>
	import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export const route = {
	preload: ({ params }) => {
		if (!params.slug) return;
		return getWorkBySlug(params.slug);
	},
} satisfies RouteDefinition;

export default function WorkPage() {
	const params = useParams();
	const work = createAsync(
		() => {
			if (!params.slug) return Promise.resolve(null);
			return getWorkBySlug(params.slug);
		},
		{
			deferStream: true,
		},
	);

	return (
		<>
			<Show when={work()} fallback={<Spinner color="grey" />}>
				{(data) => (
					<PageLayout
						title={data().title}
						description={data().summary || data().meta?.description || ""}
					>
						<article>
							<h1>{data().title}</h1>
							<p>{data().summary}</p>
							<div innerHTML={data().content} />
							<Show when={data().arenaBlocks && data().arenaBlocks.length > 0}>
								<For each={data().arenaBlocks}>
									{(block) => (
										<ArenaCarousel
											slug={block.slug}
											{...(block.title ? { title: block.title } : {})}
										/>
									)}
								</For>
							</Show>
						</article>
					</PageLayout>
				)}
			</Show>
		</>
	);
}

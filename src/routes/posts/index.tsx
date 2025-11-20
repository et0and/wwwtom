import { createAsync, useSearchParams, A } from "@solidjs/router";
import { getPosts } from "~/libs/actions/payload";
import PageLayout from "~/components/PageLayout";
import { Suspense, Show } from "solid-js";
import Spinner from "~/components/Spinner";

export default function PostsHome() {
	const [searchParams] = useSearchParams();
	const currentPage = () => Number(searchParams.page) || 1;
	const posts = createAsync(() => getPosts(currentPage()));

	return (
		<PageLayout title="Writing" description="Some of my writing">
			<h1>Writing</h1>
			<p>Some of my writing.</p>
			<Suspense fallback={<Spinner color="grey" />}>
				<Show when={posts()}>
					{(postsData) => (
						<>
							{postsData().data.map((post) => (
								<A preload={true} href={`/posts/${post.slug}`}>
									<div>
										<h2>{post.title}</h2>
										<time>
											{new Date(post.publishedAt).toLocaleDateString("en-NZ", {
												year: "numeric",
												month: "long",
												day: "numeric",
											})}
										</time>
										<p>{post.summary || post.meta?.description}</p>
									</div>
								</A>
							))}
							<Show when={postsData().meta.pagination}>
								{(pagination) => (
									<div class="justify-between flex item-center">
										<Show when={pagination().page > 1}>
											<A
												preload={true}
												href={`/posts?page=${pagination().page - 1}`}
											>
												Previous
											</A>
										</Show>
										<Show when={pagination().page < pagination().pageCount}>
											<A href={`/posts?page=${pagination().page + 1}`}>Next</A>
										</Show>
									</div>
								)}
							</Show>
						</>
					)}
				</Show>
			</Suspense>
		</PageLayout>
	);
}

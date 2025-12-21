import { createAsync, useSearchParams } from "@solidjs/router";
import { getPosts } from "~/libs/actions/payload";
import PageLayout from "~/components/PageLayout";
import { Suspense, Show } from "solid-js";
import { Spinner } from "~/components/Spinner";
import { Link } from "~/components/Link";

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
							<Show when={(postsData() as any).error}>
								{(error) => (
									<div class="banner" role="alert">
										<p class="banner-title">Error loading posts</p>
										<p>{error()}</p>
									</div>
								)}
							</Show>
							<Show when={postsData().data.length > 0}>
								{postsData().data.map((post) => (
									<Link
										class="page"
										preload={true}
										href={`/posts/${post.slug}`}
									>
										<div>
											<h2>{post.title}</h2>
											<time>
												{new Date(post.publishedAt).toLocaleDateString(
													"en-NZ",
													{
														year: "numeric",
														month: "long",
														day: "numeric",
													},
												)}
											</time>
											<p>{post.summary || post.meta?.description}</p>
										</div>
									</Link>
								))}
							</Show>
							<Show
								when={
									postsData().data.length === 0 && !(postsData() as any).error
								}
							>
								<p>No posts found.</p>
							</Show>
							<Show when={postsData().meta.pagination}>
								{(pagination) => (
									<div class="justify-between flex item-center">
										<Show when={pagination().page > 1}>
											<Link
												preload={true}
												href={`/posts?page=${pagination().page - 1}`}
											>
												Previous
											</Link>
										</Show>
										<Show when={pagination().page < pagination().pageCount}>
											<Link href={`/posts?page=${pagination().page + 1}`}>
												Next
											</Link>
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

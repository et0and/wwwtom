import { createAsync } from "@solidjs/router";
import { getPosts } from "~/lib/strapi";
import PageLayout from "~/components/PageLayout";

export default function PostsHome() {
	const posts = createAsync(() => getPosts());

	return (
		<PageLayout title="Writing" description="Some of my writing">
			<h1>Writing</h1>

			{posts() ? (
				posts()!.map((post) => (
					<a href={`/posts/${post.slug}`}>
						<div>
							<h2>{post.title}</h2>
							<time>{new Date(post.publishedAt).toLocaleDateString()}</time>
							<p>{post.summary}</p>
						</div>
					</a>
				))
			) : (
				<p>Loading...</p>
			)}
		</PageLayout>
	);
}

import PageLayout from "~/components/PageLayout";
import { postPages } from "~/types/post-routes";

export default function PostsHome() {
	return (
		<>
			<PageLayout title="Writing" description="Some of my writing">
				<h1>Writing</h1>

				{postPages.map((post) => (
					<a href={post.href}>
						<div>
							<h2>{post.title}</h2>
							<time>{post.publishedAt}</time>
						</div>
					</a>
				))}
			</PageLayout>
		</>
	);
}

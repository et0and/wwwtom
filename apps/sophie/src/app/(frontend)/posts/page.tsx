import { SideBySide } from "../../../components/SideBySide";
import Link from "next/link";
import { siteNav } from "../site-config";
import { getPublishedPostsPage } from "./post-data";
import { isPopulated } from "../../../utilities/isPopulated";

interface PostsPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
  }>;
}

function postsUrl(params: { page?: number; category?: string }): string {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set("category", params.category);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  const qs = searchParams.toString();
  return qs ? `/posts?${qs}` : "/posts";
}

export default async function PostsPage(props: PostsPageProps) {
  const query = await props.searchParams;
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const categorySlug = query.category;
  const { posts, totalPages, categoryName } = await getPublishedPostsPage(page, categorySlug);

  return (
    <SideBySide nav={siteNav}>
      <div className="space-y-8">
        <h1 className="text-3xl font-medium">Posts</h1>
        {categoryName && (
          <div className="text-sm text-gray-600">
            Showing posts in &ldquo;{categoryName}&rdquo; &bull;{" "}
            <Link href="/posts" className="text-orange-600 hover:underline">
              Clear filter
            </Link>
          </div>
        )}
        {posts.length === 0 ? (
          <p>{categorySlug ? "No posts found in this category." : "No posts yet."}</p>
        ) : (
          <>
            <div className="space-y-6">
              {posts.map((post) => (
                <article key={post.id} className="border-b border-gray-200 pb-6 last:border-0">
                  <Link prefetch={true} href={`/posts/${post.slug}`} className="group block">
                    <h2 className="text-xl font-medium group-hover:text-orange-600 transition-colors">
                      {post.title}
                    </h2>
                  </Link>
                  {post.excerpt && <p className="mt-2 text-gray-600">{post.excerpt}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                    {post.author && isPopulated(post.author) && <span>By {post.author.name}</span>}
                    {post.category && isPopulated(post.category) && (
                      <span>
                        <Link
                          href={`/posts?category=${post.category.slug}`}
                          className="hover:text-orange-600 transition-colors"
                        >
                          {post.category.title}
                        </Link>
                      </span>
                    )}
                    {post.publishedAt && (
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
                {page > 1 && (
                  <Link
                    href={postsUrl({ page: page - 1, category: categorySlug })}
                    className="px-3 py-1 border border-gray-300 rounded hover:border-orange-600 transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={postsUrl({ page: p, category: categorySlug })}
                    className={`px-3 py-1 border rounded transition-colors ${
                      p === page
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-gray-300 hover:border-orange-600"
                    }`}
                    aria-current={p === page ? "page" : undefined}
                  >
                    {p}
                  </Link>
                ))}
                {page < totalPages && (
                  <Link
                    href={postsUrl({ page: page + 1, category: categorySlug })}
                    className="px-3 py-1 border border-gray-300 rounded hover:border-orange-600 transition-colors"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </SideBySide>
  );
}

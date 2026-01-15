import { createAsync, useSearchParams } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { createEffect } from "solid-js";
import { getPosts } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";
import { Suspense, Show, For } from "solid-js";
import { Spinner, Link } from "~/components";

export default function PostsHome() {
  const [searchParams] = useSearchParams();
  const currentPage = () => Number(searchParams.page) || 1;
  const posts = createAsync(() => getPosts(currentPage()));

  createEffect(() => {
    const event = getRequestEvent();
    if (event) {
      event.response.headers.set(
        "Cache-Control",
        "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      );
      event.response.headers.set(
        "CDN-Cache-Control",
        "public, max-age=600, stale-while-revalidate=86400",
      );
    }
  });

  return (
    <PageLayout
      title="Writing"
      description="Some of my writing"
      canonical="https://tom.so/posts"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Writing",
        description: "Some of my writing",
        url: "https://tom.so/posts",
      }}
    >
      <h1>Writing</h1>
      <p>Some of my writing.</p>
      <Suspense fallback={<Spinner color="grey" />}>
        <Show when={posts()}>
          {(data) => (
            <>
              <Show when={"error" in data()}>
                {(error) => (
                  <div class="banner" role="alert">
                    <p class="banner-title">Error loading posts</p>
                    <p>{error()}</p>
                  </div>
                )}
              </Show>
              <Show when={data().data && data().data.length > 0}>
                <For each={data().data}>
                  {(post) => (
                    <Link class="page" preload={true} href={`/posts/${post.slug}`}>
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
                    </Link>
                  )}
                </For>
              </Show>
              <Show when={(!data().data || data().data.length === 0) && !("error" in data())}>
                <p>No posts found.</p>
              </Show>
              <Show when={data().meta?.pagination}>
                {(pagination) => (
                  <div class="justify-between flex item-center">
                    <Show when={pagination().page > 1}>
                      <Link preload={true} href={`/posts?page=${pagination().page - 1}`}>
                        Previous
                      </Link>
                    </Show>
                    <Show when={pagination().page < pagination().pageCount}>
                      <Link href={`/posts?page=${pagination().page + 1}`}>Next</Link>
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

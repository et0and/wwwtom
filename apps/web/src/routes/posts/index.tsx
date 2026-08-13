import type { RouteDefinition, RouteSectionProps } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchPosts } from "~/server/adapter";
import { PageLayout } from "@tom/ui/PageLayout";
import { Suspense, Show, For } from "solid-js";
import { Link } from "@tom/ui/Link";
import { Spinner } from "@tom/ui/Spinner";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { queryClient } from "~/libs/query-client";

export const route = {
  preload: ({ location }) => {
    const page = Number(location.query.page) || 1;
    queryClient
      .prefetchQuery({
        queryKey: ["posts", page],
        queryFn: () => fetchPosts(page, 5),
      })
      .catch(() => {
        // A failed prefetch surfaces through the query's error state — don't
        // let the rejection fail the SSR request.
      });
  },
} satisfies RouteDefinition;

export default function PostsHome(props: RouteSectionProps) {
  const currentPage = () => Number(props.location.query.page) || 1;
  const event = getRequestEvent();

  if (event) {
    event.response.headers.set(
      "Cache-Control",
      "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
    );
    event.response.headers.set(
      "CDN-Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );
  }

  const postsQuery = useQuery(() => ({
    queryKey: ["posts", currentPage()],
    queryFn: () => fetchPosts(currentPage(), 5),
  }));

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
      <BlurInText text="Writing" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <p>Some of my writing.</p>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <Suspense fallback={<Spinner color="grey" />}>
          <Show when={postsQuery.isError}>
            <div class="banner" role="alert">
              <p class="banner-title">Error loading posts</p>
              <p>{postsQuery.error?.message}</p>
            </div>
          </Show>
          <Show when={postsQuery.data}>
            {(result) => {
              const r = result();
              return (
                <>
                  <Show when={r.data && r.data.length > 0}>
                    <For each={r.data}>
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
                  <Show when={!r.data || r.data.length === 0}>
                    <p>No posts found.</p>
                  </Show>
                  <Show when={r.meta?.pagination}>
                    {(pg) => {
                      const pagination = pg();
                      return (
                        <div class="justify-between flex item-center">
                          <Show when={pagination.page > 1}>
                            <Link preload={true} href={`/posts?page=${pagination.page - 1}`}>
                              Previous
                            </Link>
                          </Show>
                          <Show when={pagination.page < pagination.pageCount}>
                            <Link href={`/posts?page=${pagination.page + 1}`}>Next</Link>
                          </Show>
                        </div>
                      );
                    }}
                  </Show>
                </>
              );
            }}
          </Show>
        </Suspense>
      </BlurInSection>
    </PageLayout>
  );
}

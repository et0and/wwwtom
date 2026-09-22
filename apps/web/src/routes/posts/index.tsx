import { httpHeader } from "@solidjs/web";
import { useLocation } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { POSTS_PAGE_SIZE, fetchPosts } from "~/server/adapter";
import { PUBLIC_PAGE_CACHE_CONTROL, PUBLIC_PAGE_CDN_CACHE_CONTROL } from "@tom/constants/cache";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { Loading, Show, For } from "solid-js";
import { Link } from "@tom/ui/link";
import { Loader } from "@tom/ui/loader";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { formatDate } from "@tom/utils/date";
import { parsePageNumber } from "@tom/utils/page";

export default function PostsHome() {
  httpHeader("Cache-Control", PUBLIC_PAGE_CACHE_CONTROL);
  httpHeader("CDN-Cache-Control", PUBLIC_PAGE_CDN_CACHE_CONTROL);

  const location = useLocation();
  const currentPage = () => parsePageNumber(location.query.page);

  const postsQuery = useQuery(() => ({
    queryKey: ["posts", currentPage()],
    queryFn: () => fetchPosts(currentPage(), POSTS_PAGE_SIZE),
    // Hold the SSR stream until the list resolves, so a direct load paints
    // with items instead of a blank spinner. No placeholderData: keeping the
    // previous page as placeholder wedges key-change navigation on this
    // Query version — the new page never replaces it (pinned by the
    // pagination test below).
    deferStream: true,
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
        <Text>Some of my writing.</Text>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <Loading fallback={<Loader />}>
          <Show when={postsQuery.isError}>
            <div class="banner" role="alert">
              <Text class="banner-title">Error loading posts</Text>
              <Text>{postsQuery.error?.message}</Text>
            </div>
          </Show>
          {/* keyed: a preloaded page swap replaces the data object without
              toggling truthiness, which a non-keyed Show would not re-render. */}
          <Show when={postsQuery.data} keyed>
            {(postsPage) => (
              <>
                <Show
                  when={postsPage.docs.length > 0}
                  fallback={<Text variant="secondary">No posts found.</Text>}
                >
                  <For each={postsPage.docs}>
                    {(post) => (
                      <Link
                        variant="current"
                        class="page block!"
                        preload={true}
                        href={`/posts/${post.slug}`}
                      >
                        <div>
                          <Text variant="heading" as="h2">
                            {post.title}
                          </Text>
                          <Text variant="secondary" size="sm" as="time">
                            {formatDate(post.publishedAt)}
                          </Text>
                          <Text>{post.summary ?? ""}</Text>
                        </div>
                      </Link>
                    )}
                  </For>
                </Show>
                <div class="justify-between flex item-center">
                  <Show when={postsPage.page > 1}>
                    <Link
                      variant="current"
                      preload={true}
                      href={`/posts?page=${postsPage.page - 1}`}
                    >
                      Previous
                    </Link>
                  </Show>
                  <Show when={postsPage.page < postsPage.totalPages}>
                    <Link variant="current" href={`/posts?page=${postsPage.page + 1}`}>
                      Next
                    </Link>
                  </Show>
                </div>
              </>
            )}
          </Show>
        </Loading>
      </BlurInSection>
    </PageLayout>
  );
}

import { Match, Switch, createMemo } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useParams } from "@solidjs/router";
import { httpHeader } from "@solidjs/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchPostBySlug } from "~/server/adapter";
import { PUBLIC_PAGE_CACHE_CONTROL, PUBLIC_PAGE_CDN_CACHE_CONTROL } from "@tom/constants/cache";
import { PageLayout } from "@tom/ui/PageLayout";
import { layout } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { formatDate } from "@tom/utils/date";
import {
  ArenaSourceLink,
  DetailError,
  DetailLoading,
  DetailNotFound,
} from "~/content/DetailStates";
import { ContentBlocks } from "~/content/ContentBlocks";

export default function PostPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);

  httpHeader("Cache-Control", PUBLIC_PAGE_CACHE_CONTROL);
  httpHeader("CDN-Cache-Control", PUBLIC_PAGE_CDN_CACHE_CONTROL);

  const postQuery = useQuery(() => ({
    queryKey: ["post", slug()],
    queryFn: () => {
      const currentSlug = slug();
      if (!currentSlug) return Promise.resolve(null);
      return fetchPostBySlug(currentSlug);
    },
    // Hold the SSR stream until the post resolves, so the <head> is flushed
    // with title/og meta instead of an empty head.
    deferStream: true,
    // Absent slugs settle as null data: evict fast so a freshly published
    // slug refetches instead of replaying Not found from the cache.
    gcTime: 1000 * 60,
  }));

  return (
    // Absent posts settle as null data (the fetcher maps 404s in the Effect
    // layer): pending renders loading, settled data renders content,
    // settled error renders the banner, settled null falls to not-found.
    <Switch fallback={<DetailNotFound kind="post" slug={slug()} />}>
      <Match when={postQuery.isPending}>
        <DetailLoading />
      </Match>
      {/* keyed: a preloaded post swap replaces the data object without
          toggling truthiness, which a non-keyed Match would not re-render. */}
      <Match when={postQuery.data} keyed>
        {(post) => (
          <PageLayout
            title={post.title}
            description={post.summary ?? ""}
            canonical={`https://tom.so/posts/${slug()}`}
            jsonLd={{
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              description: post.summary ?? "",
              datePublished: post.publishedAt,
              dateModified: post.updatedAt,
              url: `https://tom.so/posts/${slug()}`,
              author: { "@type": "Person", name: "Tom Hackshaw" },
            }}
          >
            <article>
              <Text variant="heading" size="lg" as="h1" blurIn>
                {post.title}
              </Text>
              <div>
                <Text variant="heading" as="h2">
                  {post.summary ?? ""}
                </Text>
              </div>
              <div>
                <div {...stylex.attrs(layout.flexCol, layout.gap1_5)}>
                  <Text variant="secondary" size="sm" as="time">
                    {formatDate(post.publishedAt)}
                  </Text>
                  <ArenaSourceLink arenaSlug={post.arenaSlug} />
                </div>
              </div>
              <div>
                <ContentBlocks blocks={post.blocks} />
              </div>
            </article>
          </PageLayout>
        )}
      </Match>
      <Match when={postQuery.isError}>
        <DetailError kind="post" message={postQuery.error?.message ?? "Load failed"} />
      </Match>
    </Switch>
  );
}

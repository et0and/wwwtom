import { Match, Switch, createMemo } from "solid-js";
import { useParams } from "@solidjs/router";
import { httpHeader } from "@solidjs/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchPostBySlug } from "~/server/adapter";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import {
  DetailArenaBlocks,
  DetailError,
  DetailLoading,
  DetailNotFound,
} from "~/components/DetailStates";

export default function PostPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);

  httpHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
  httpHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

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
      <Match when={postQuery.data}>
        {(data) => {
          const post = data();
          return (
            <PageLayout
              title={post.title}
              // An empty summary falls back to the meta description.
              description={post.summary || post.meta?.description || ""}
              canonical={`https://tom.so/posts/${slug()}`}
              jsonLd={{
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.title,
                description: post.summary || post.meta?.description || "",
                datePublished: post.publishedAt ?? "",
                dateModified: post.updatedAt ?? "",
                url: `https://tom.so/posts/${slug()}`,
                author: { "@type": "Person", name: "Tom Hackshaw" },
              }}
            >
              <article>
                <BlurInText text={post.title} tag="h1" baseDelay={0.1} step={0.025} />
                <BlurInSection delay={0.3}>
                  <Text variant="heading" as="h2">
                    {post.meta?.description ?? ""}
                  </Text>
                </BlurInSection>
                <BlurInSection delay={0.5}>
                  {post.publishedAt ? (
                    <Text variant="secondary" size="sm" as="time">
                      {new Date(post.publishedAt).toLocaleDateString("en-NZ", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  ) : null}
                </BlurInSection>
                <BlurInSection delay={0.7}>
                  <div class="pt-8" innerHTML={post.html ?? ""} />
                </BlurInSection>
                <DetailArenaBlocks blocks={post.arenaBlocks ?? []} baseDelay={0.9} />
              </article>
            </PageLayout>
          );
        }}
      </Match>
      <Match when={postQuery.isError}>
        <DetailError kind="post" message={postQuery.error?.message ?? "Load failed"} />
      </Match>
    </Switch>
  );
}

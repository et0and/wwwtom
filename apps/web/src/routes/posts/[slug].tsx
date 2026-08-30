import { For, Show, createMemo } from "solid-js";
import { useParams } from "@solidjs/router";
import { httpHeader } from "@solidjs/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchPostBySlug } from "~/server/adapter";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { ArenaCarousel } from "~/components/Arena";

const PostNotFound = ({ slug }: { slug: string | undefined }) => (
  <PageLayout title="Not found" description="The page you are looking for does not exist.">
    <article>
      <BlurInText text="Not found" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <p>The post "{slug}" does not exist.</p>
      </BlurInSection>
    </article>
  </PageLayout>
);

export default function PostPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);

  httpHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
  httpHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  const postQuery = useQuery(() => ({
    queryKey: ["post", slug()],
    queryFn: () => {
      const s = slug();
      if (!s) return Promise.reject(new Error("No slug"));
      return fetchPostBySlug(s);
    },
    // Hold the SSR stream until the post resolves, so the <head> is flushed
    // with title/og meta instead of an empty head.
    deferStream: true,
  }));

  return (
    // Unknown slugs resolve the post query to null; without a fallback the
    // page renders nothing (or crashes on a missing title) instead of a
    // not-found state.
    <Show when={postQuery.data} fallback={<PostNotFound slug={slug()} />}>
      {(data) => {
        const d = data();
        if (!d.title) return <PostNotFound slug={slug()} />;
        return (
          <PageLayout
            title={d.title}
            description={d.summary || d.meta?.description || ""}
            canonical={`https://tom.so/posts/${slug()}`}
            jsonLd={{
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: d.title,
              description: d.summary || d.meta?.description || "",
              datePublished: d.publishedAt ?? "",
              dateModified: d.updatedAt ?? "",
              url: `https://tom.so/posts/${slug()}`,
              author: { "@type": "Person", name: "Tom Hackshaw" },
            }}
          >
            <article>
              <BlurInText text={d.title} tag="h1" baseDelay={0.1} step={0.025} />
              <BlurInSection delay={0.3}>
                <h2>{d.meta?.description ?? ""}</h2>
              </BlurInSection>
              <BlurInSection delay={0.5}>
                {d.publishedAt ? (
                  <time>
                    {new Date(d.publishedAt ?? "").toLocaleDateString("en-NZ", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                ) : null}
              </BlurInSection>
              <BlurInSection delay={0.7}>
                <div class="pt-8" innerHTML={d.content ?? ""} />
              </BlurInSection>
              <For each={d.arenaBlocks ?? []}>
                {(block, index) => (
                  <BlurInSection delay={0.9 + index() * 0.2}>
                    <ArenaCarousel
                      slug={block.slug}
                      {...(block.title ? { title: block.title } : {})}
                    />
                  </BlurInSection>
                )}
              </For>
            </article>
          </PageLayout>
        );
      }}
    </Show>
  );
}

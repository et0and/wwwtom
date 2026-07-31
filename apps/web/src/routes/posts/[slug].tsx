import { lazy, For, Show, createMemo } from "solid-js";
import { useParams, type RouteDefinition } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { getRequestEvent } from "solid-js/web";
import { getPostBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";
import { Spinner, BlurInSection, BlurInText } from "~/components";
import { queryClient } from "~/libs/query-client";

export const route = {
  preload: ({ params }) => {
    if (params.slug) {
      queryClient.prefetchQuery({
        queryKey: ["post", params.slug],
        queryFn: () => getPostBySlug(params.slug!),
      });
    }
  },
} satisfies RouteDefinition;

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export default function PostPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);
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

  const postQuery = useQuery(() => ({
    queryKey: ["post", slug()],
    queryFn: () => {
      const s = slug();
      if (!s) return Promise.reject(new Error("No slug"));
      return getPostBySlug(s);
    },
  }));

  return (
    <Show when={postQuery.data} fallback={<Spinner color="grey" />}>
      {(data) => {
        const d = data();
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

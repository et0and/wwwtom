import { lazy, For, Show, createMemo } from "solid-js";
import { useParams, type RouteDefinition } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { getRequestEvent } from "solid-js/web";
import { fetchWorkBySlug } from "~/server/adapter";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { queryClient } from "~/libs/query-client";

export const route = {
  preload: ({ params }) => {
    if (params.slug) {
      queryClient
        .prefetchQuery({
          queryKey: ["work", params.slug],
          queryFn: () => fetchWorkBySlug(params.slug!),
        })
        .catch(() => {
          // A failed prefetch surfaces through the query's error state — don't
          // let the rejection fail the SSR request.
        });
    }
  },
} satisfies RouteDefinition;

const ArenaCarousel = lazy(() =>
  import("~/components/Arena").then((m) => ({ default: m.ArenaCarousel })),
);

export default function WorkPage() {
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

  const workQuery = useQuery(() => ({
    queryKey: ["work", slug()],
    queryFn: () => {
      const s = slug();
      if (!s) return Promise.reject(new Error("No slug"));
      return fetchWorkBySlug(s);
    },
    // Hold the SSR stream until the work resolves, so the <head> is flushed
    // with title/og meta instead of an empty head.
    deferStream: true,
  }));

  return (
    <Show when={workQuery.data}>
      {(data) => {
        const d = data();
        return (
          <PageLayout
            title={d.title}
            description={d.summary || d.meta?.description || ""}
            canonical={`https://tom.so/work/${slug()}`}
            jsonLd={{
              "@context": "https://schema.org",
              "@type": "CreativeWork",
              name: d.title,
              description: d.summary || d.meta?.description || "",
              url: `https://tom.so/work/${slug()}`,
              author: { "@type": "Person", name: "Tom Hackshaw" },
            }}
          >
            <article>
              <BlurInText text={d.title} tag="h1" baseDelay={0.1} step={0.025} />
              <BlurInSection delay={0.3}>
                <p>{d.summary ?? ""}</p>
              </BlurInSection>
              <BlurInSection delay={0.5}>
                <div innerHTML={d.content ?? ""} />
              </BlurInSection>
              <For each={d.arenaBlocks ?? []}>
                {(block, index) => (
                  <BlurInSection delay={0.7 + index() * 0.2}>
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

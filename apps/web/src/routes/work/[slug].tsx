import { Match, Switch, createMemo } from "solid-js";
import { useParams } from "@solidjs/router";
import { httpHeader } from "@solidjs/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchWorkBySlug } from "~/server/adapter";
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

export default function WorkPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);

  httpHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
  httpHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  const workQuery = useQuery(() => ({
    queryKey: ["work", slug()],
    queryFn: () => {
      const currentSlug = slug();
      if (!currentSlug) return Promise.resolve(null);
      return fetchWorkBySlug(currentSlug);
    },
    // Hold the SSR stream until the work resolves, so the <head> is flushed
    // with title/og meta instead of an empty head.
    deferStream: true,
    // Absent slugs settle as null data: evict fast so a freshly published
    // slug refetches instead of replaying Not found from the cache.
    gcTime: 1000 * 60,
  }));

  return (
    // Absent works settle as null data (the fetcher maps 404s in the Effect
    // layer): pending renders loading, settled data renders content,
    // settled error renders the banner, settled null falls to not-found.
    <Switch fallback={<DetailNotFound kind="work" slug={slug()} />}>
      <Match when={workQuery.isPending}>
        <DetailLoading />
      </Match>
      <Match when={workQuery.data}>
        {(data) => {
          const work = data();
          return (
            <PageLayout
              title={work.title}
              // An empty summary falls back to the meta description.
              description={work.summary || work.meta?.description || ""}
              canonical={`https://tom.so/work/${slug()}`}
              jsonLd={{
                "@context": "https://schema.org",
                "@type": "CreativeWork",
                name: work.title,
                description: work.summary || work.meta?.description || "",
                url: `https://tom.so/work/${slug()}`,
                author: { "@type": "Person", name: "Tom Hackshaw" },
              }}
            >
              <article>
                <BlurInText text={work.title} tag="h1" baseDelay={0.1} step={0.025} />
                <BlurInSection delay={0.3}>
                  <Text>{work.summary ?? ""}</Text>
                </BlurInSection>
                <BlurInSection delay={0.5}>
                  <div innerHTML={work.html ?? ""} />
                </BlurInSection>
                <DetailArenaBlocks blocks={work.arenaBlocks ?? []} baseDelay={0.7} />
              </article>
            </PageLayout>
          );
        }}
      </Match>
      <Match when={workQuery.isError}>
        <DetailError kind="work" message={workQuery.error?.message ?? "Load failed"} />
      </Match>
    </Switch>
  );
}

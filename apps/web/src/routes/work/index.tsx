import { httpHeader } from "@solidjs/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchWorks } from "~/server/adapter";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { Loading, For, Show } from "solid-js";
import { Link } from "@tom/ui/link";
import { Loader } from "@tom/ui/loader";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";

export default function WorkHome() {
  httpHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
  httpHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  const worksQuery = useQuery(() => ({
    queryKey: ["works"],
    queryFn: () => fetchWorks(),
    // Hold the SSR stream until the list resolves, so a direct load paints
    // with items instead of a blank spinner.
    deferStream: true,
  }));

  return (
    <PageLayout
      title="Work"
      description="Some work that I have made"
      canonical="https://tom.so/work"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Work",
        description: "Some work that I have made",
        url: "https://tom.so/work",
      }}
    >
      <BlurInText text="Work" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <Text>Some work that I have made.</Text>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <Loading fallback={<Loader />}>
          <Show when={worksQuery.isError}>
            <div class="banner" role="alert">
              <Text class="banner-title">Error loading works</Text>
              <Text>{worksQuery.error?.message}</Text>
            </div>
          </Show>
          <Show when={worksQuery.data}>
            {(worksData) => (
              <For each={worksData().docs}>
                {(work) => (
                  <Link
                    variant="current"
                    class="page block!"
                    preload={true}
                    href={`/work/${work.slug}`}
                  >
                    <Text variant="heading" as="h2">
                      {work.title}
                    </Text>
                    <Text>{work.summary}</Text>
                  </Link>
                )}
              </For>
            )}
          </Show>
        </Loading>
      </BlurInSection>
    </PageLayout>
  );
}

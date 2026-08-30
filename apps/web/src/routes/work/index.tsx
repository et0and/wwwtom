import { httpHeader } from "@solidjs/web";
import { useQuery } from "@tanstack/solid-query";
import { fetchWorks } from "~/server/adapter";
import { PageLayout } from "@tom/ui/PageLayout";
import { Loading, For, Show } from "solid-js";
import { Link } from "@tom/ui/Link";
import { Spinner } from "@tom/ui/Spinner";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";

export default function WorkHome() {
  httpHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
  httpHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  const worksQuery = useQuery(() => ({
    queryKey: ["works"],
    queryFn: () => fetchWorks(),
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
        <p>Some work that I have made.</p>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <Loading fallback={<Spinner color="grey" />}>
          <Show when={worksQuery.isError}>
            <div class="banner" role="alert">
              <p class="banner-title">Error loading works</p>
              <p>{worksQuery.error?.message}</p>
            </div>
          </Show>
          <Show when={worksQuery.data}>
            {(worksData) => (
              <For each={worksData()}>
                {(work) => (
                  <Link class="page" preload={true} href={`/work/${work.slug}`}>
                    <h2>{work.title}</h2>
                    <p>{work.summary}</p>
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

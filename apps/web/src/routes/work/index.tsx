import { createAsync } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getWorks } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";
import { Suspense, For, Show } from "solid-js";
import { Spinner, Link } from "~/components";

export const route = {
  preload: () => getWorks(),
};

export default function WorkHome() {
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

  const works = createAsync(() => getWorks());

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
      <h1>Work</h1>
      <p>Some work that I have made.</p>
      <Suspense fallback={<Spinner color="grey" />}>
        <Show when={works()}>
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
      </Suspense>
    </PageLayout>
  );
}

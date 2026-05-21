import { lazy, For, Show, createMemo } from "solid-js";
import { Effect } from "effect";
import { createAsync, useParams } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getWorkBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";

import { Spinner, BlurInSection, BlurInText } from "~/components";

const scope = "wwwtom:apps:web:route:work";

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
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

  const work = createAsync(() => {
    const s = slug();
    if (!s) return Promise.resolve(null);
    void Effect.runFork(Effect.logInfo(`${scope}:load slug=${s}`));
    return getWorkBySlug(s);
  });

  return (
    <Show when={work()} fallback={<Spinner color="grey" />}>
      {(data) => (
        <PageLayout
          title={data().title}
          description={data().summary || data().meta?.description || ""}
          canonical={`https://tom.so/work/${slug()}`}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: data().title,
            description: data().summary || data().meta?.description || "",
            url: `https://tom.so/work/${slug()}`,
            author: { "@type": "Person", name: "Tom Hackshaw" },
          }}
        >
          <article>
            <BlurInText text={data().title} class="h1" baseDelay={0.1} step={0.025} />
            <BlurInSection delay={0.3}>
              <p>{data().summary ?? ""}</p>
            </BlurInSection>
            <BlurInSection delay={0.5}>
              <div innerHTML={data().content ?? ""} />
            </BlurInSection>
            <For each={data().arenaBlocks ?? []}>
              {(block, index) => (
                <BlurInSection delay={0.7 + index() * 0.2}>
                  <ArenaCarousel slug={block.slug} {...(block.title ? { title: block.title } : {})} />
                </BlurInSection>
              )}
            </For>
          </article>
        </PageLayout>
      )}
    </Show>
  );
}

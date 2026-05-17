import { lazy, For, Show, createMemo } from "solid-js";
import { Effect } from "effect";
import { createAsync, useParams } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getWorkBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";

import { Spinner } from "~/components";

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
            <h1>{data().title}</h1>
            <p>{data().summary ?? ""}</p>
            <div innerHTML={data().content ?? ""} />
            <For each={data().arenaBlocks ?? []}>
              {(block) => (
                <ArenaCarousel slug={block.slug} {...(block.title ? { title: block.title } : {})} />
              )}
            </For>
          </article>
        </PageLayout>
      )}
    </Show>
  );
}

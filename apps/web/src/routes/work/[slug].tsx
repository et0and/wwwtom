import { Show, lazy, For, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getWorkBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";

import { Spinner } from "~/components";

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export const route = {
  preload: ({ params }) => {
    if (!params.slug) return;
    return getWorkBySlug(params.slug);
  },
} satisfies RouteDefinition;

export default function WorkPage() {
  const params = useParams();
  const work = createAsync(
    () => {
      if (!params.slug) return Promise.resolve(null);
      return getWorkBySlug(params.slug);
    },
    {
      deferStream: true,
    },
  );

  createEffect(() => {
    const event = getRequestEvent();
    if (event) {
      event.response.headers.set(
        "Cache-Control",
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      );
      event.response.headers.set(
        "CDN-Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400",
      );
    }
  });

  return (
    <>
      <Show when={work()} fallback={<Spinner color="grey" />}>
        {(data) => (
          <PageLayout
            title={data().title}
            description={data().summary || data().meta?.description || ""}
            canonical={`https://tom.so/work/${params.slug}`}
            jsonLd={{
              "@context": "https://schema.org",
              "@type": "CreativeWork",
              name: data().title,
              description: data().summary || data().meta?.description || "",
              url: `https://tom.so/work/${params.slug}`,
              author: { "@type": "Person", name: "Tom Hackshaw" },
            }}
          >
            <article>
              <h1>{data().title}</h1>
              <p>{data().summary}</p>
              <div innerHTML={data().content} />
              <Show when={data().arenaBlocks && data().arenaBlocks.length > 0}>
                <For each={data().arenaBlocks}>
                  {(block) => (
                    <ArenaCarousel
                      slug={block.slug}
                      {...(block.title ? { title: block.title } : {})}
                    />
                  )}
                </For>
              </Show>
            </article>
          </PageLayout>
        )}
      </Show>
    </>
  );
}

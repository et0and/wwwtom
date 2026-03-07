import { Show, lazy, For, createMemo } from "solid-js";
import { Effect } from "effect";
import { createAsync, type RouteDefinition, useParams } from "@solidjs/router";
import { getWorkBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";

import { Spinner } from "~/components";

const scope = "wwwtom:apps:web:route:work";

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export const route = {
  preload: ({ params }) => {
    if (!params.slug) return;
    void Effect.runFork(Effect.logInfo(`${scope}:preload slug=${params.slug}`));
    return getWorkBySlug(params.slug);
  },
} satisfies RouteDefinition;

export default function WorkPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);

  const work = createAsync(() => {
    const s = slug();
    if (!s) return Promise.resolve(null);
    void Effect.runFork(Effect.logInfo(`${scope}:load slug=${s}`));
    return getWorkBySlug(s);
  });

  return (
    <>
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

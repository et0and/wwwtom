import { Show, lazy, For, createEffect, createMemo } from "solid-js";
import { useParams } from "@solidjs/router";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getPostBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";
import { Spinner } from "~/components";

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export const route = {
  preload: ({ params }) => {
    if (!params.slug) return;
    return getPostBySlug(params.slug);
  },
} satisfies RouteDefinition;

export default function PostPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug);
  const post = createAsync(
    () => {
      const s = slug();
      if (!s) return Promise.resolve(null);
      return getPostBySlug(s);
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
      <Show when={post()} fallback={<Spinner color="grey" />}>
        {(data) => (
          <PageLayout
            title={data().title}
            description={data().summary || data().meta?.description || ""}
            canonical={`https://tom.so/posts/${params.slug}`}
            jsonLd={{
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: data().title,
              description: data().summary || data().meta?.description || "",
              datePublished: data().publishedAt,
              dateModified: data().updatedAt,
              url: `https://tom.so/posts/${params.slug}`,
              author: { "@type": "Person", name: "Tom Hackshaw" },
            }}
          >
            <article>
              <h1>{data().title}</h1>
              <h2>{data().meta?.description}</h2>
              <time>
                {new Date(data().publishedAt).toLocaleDateString("en-NZ", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <div class="pt-8" innerHTML={data().content} />
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

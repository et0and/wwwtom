import { Show, lazy, For } from "solid-js";
import { Effect } from "effect";
import { createAsync, type RouteDefinition, useParams } from "@solidjs/router";
import { getPostBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";
import { Spinner } from "~/components";

const scope = "wwwtom:apps:web:route:posts";

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export const route = {
  preload: ({ params }) => {
    if (!params.slug) return;
    void Effect.runFork(Effect.logInfo(`${scope}:preload slug=${params.slug}`));
    return getPostBySlug(params.slug);
  },
} satisfies RouteDefinition;

export default function PostPage() {
  const params = useParams();
  const post = createAsync(
    () => {
      if (!params.slug) return Promise.resolve(null);
      void Effect.runFork(Effect.logInfo(`${scope}:load slug=${params.slug}`));
      return getPostBySlug(params.slug);
    },
    {
      deferStream: true,
    },
  );

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

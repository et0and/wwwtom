import { lazy, For, Show, createMemo } from "solid-js";
import { Effect } from "effect";
import { createAsync, useParams } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getPostBySlug } from "~/libs/actions/payload";
import { PageLayout } from "~/layouts";
import { Spinner, BlurInSection, BlurInText } from "~/components";

const scope = "wwwtom:apps:web:route:posts";

const ArenaCarousel = lazy(() =>
  import("~/components").then((m) => ({ default: m.ArenaCarousel })),
);

export default function PostPage() {
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

  const post = createAsync(() => {
    const s = slug();
    if (!s) return Promise.resolve(null);
    void Effect.runFork(Effect.logInfo(`${scope}:load slug=${s}`));
    return getPostBySlug(s);
  });

  return (
    <Show when={post()} fallback={<Spinner color="grey" />}>
      {(data) => (
        <PageLayout
          title={data().title}
          description={data().summary || data().meta?.description || ""}
          canonical={`https://tom.so/posts/${slug()}`}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: data().title,
            description: data().summary || data().meta?.description || "",
            datePublished: data().publishedAt ?? "",
            dateModified: data().updatedAt ?? "",
            url: `https://tom.so/posts/${slug()}`,
            author: { "@type": "Person", name: "Tom Hackshaw" },
          }}
        >
          <article>
            <BlurInText text={data().title} class="h1" baseDelay={0.1} step={0.025} />
            <BlurInSection delay={0.3}>
              <h2>{data().meta?.description ?? ""}</h2>
            </BlurInSection>
            <BlurInSection delay={0.5}>
              {data().publishedAt ? (
                <time>
                  {new Date(data().publishedAt ?? "").toLocaleDateString("en-NZ", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              ) : null}
            </BlurInSection>
            <BlurInSection delay={0.7}>
              <div class="pt-8" innerHTML={data().content ?? ""} />
            </BlurInSection>
            <For each={data().arenaBlocks ?? []}>
              {(block, index) => (
                <BlurInSection delay={0.9 + index() * 0.2}>
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

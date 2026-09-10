import { For } from "solid-js";
import type { ArenaRef } from "@tom/schemas/cms";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { Loader } from "@tom/ui/loader";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { ArenaCarousel } from "~/components/Arena";

/** Loading shell for post/work detail pages while the query is pending. */
export const DetailLoading = () => (
  <main id="main" class="mx-auto p-8 max-w-[750px]">
    <Loader />
  </main>
);

/** Not-found state for settled-null detail reads (the fetcher maps 404s to null). */
export const DetailNotFound = (props: { kind: "post" | "work"; slug: string | undefined }) => (
  <PageLayout title="Not found" description="The page you are looking for does not exist.">
    <article>
      <BlurInText text="Not found" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <Text>
          The {props.kind} "{props.slug}" does not exist.
        </Text>
      </BlurInSection>
    </article>
  </PageLayout>
);

/** Error banner for settled-error detail reads (500s, timeouts). */
export const DetailError = (props: { kind: "post" | "work"; message: string }) => (
  <PageLayout title="Error" description={`Something went wrong loading this ${props.kind}.`}>
    <article>
      <BlurInText text="Error" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <div class="banner" role="alert">
          <Text class="banner-title">Error loading {props.kind}</Text>
          <Text>{props.message}</Text>
        </div>
      </BlurInSection>
    </article>
  </PageLayout>
);

/** Arena channel embeds for a detail page, staggered after the body. */
export const DetailArenaBlocks = (props: {
  blocks: ReadonlyArray<ArenaRef>;
  baseDelay: number;
}) => (
  <For each={props.blocks}>
    {(block, index) => (
      <BlurInSection delay={props.baseDelay + index() * 0.2}>
        <ArenaCarousel
          slug={block.slug}
          // exactOptionalPropertyTypes: omit the prop instead of passing undefined.
          {...(block.title ? { title: block.title } : {})}
        />
      </BlurInSection>
    )}
  </For>
);

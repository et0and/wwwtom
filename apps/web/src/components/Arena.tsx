import { useQuery } from "@tanstack/solid-query";
import { Effect, Option, Schema } from "effect";
import { For, Show, createMemo } from "solid-js";
import { ArenaContentBlockSchema, type ArenaContentBlock } from "@tom/schemas/arena-content";
import type { ArenaChannelContents } from "@tom/schemas/arena";
import { Loader } from "@tom/ui/loader";
import { Text } from "@tom/ui/text";
import { ContentBlocks } from "~/components/ContentBlocks";
import { fetchChannelContents } from "~/server/adapter";

interface ArenaCarouselProps {
  slug: string;
  title?: string;
}

export function ArenaCarousel(props: ArenaCarouselProps) {
  const contentsQuery = useQuery(() => ({
    queryKey: ["arena-contents", props.slug],
    queryFn: async () => {
      try {
        return await fetchChannelContents(props.slug, 10);
      } catch {
        void Effect.runFork(
          Effect.logWarning(`[arena] getChannelContents failed for slug "${props.slug}"`),
        );
        return null;
      }
    },
  }));

  const activeContents = createMemo(() => contentsQuery.data);
  const isLoading = createMemo(() => contentsQuery.isLoading);
  const hasContent = createMemo(() => {
    const response = activeContents();
    return !!(response?.data && response.data.length > 0);
  });
  return (
    <Show when={!isLoading()} fallback={<Loader />}>
      <Show
        when={hasContent()}
        fallback={
          <>
            {
              void Effect.runFork(
                Effect.logWarning(`Warning: no contents found for channel slug "${props.slug}"`),
              )
            }
            <Text variant="secondary">Sorry, no content found</Text>
          </>
        }
      >
        <div class="overflow-x-auto whitespace-nowrap border border-black">
          <div class="carousel-container inline-flex gap-4 p-4">
            <For each={activeContents()?.data || []} keyed={false}>
              {(item) => (
                <div class="carousel-item flex-shrink-0 w-80">
                  <ArenaItem item={item()} />
                </div>
              )}
            </For>
          </div>
        </div>
        <Text variant="secondary" size="xs" class="mt-2">
          Source:{" "}
          <a href={`https://are.na/tom/${props.slug}`} target="_blank" rel="noopener noreferrer">
            {props.title || props.slug}
          </a>
        </Text>
      </Show>
    </Show>
  );
}

/**
 * The SDK returns the same wire blocks the content schema describes, so the
 * carousel renders them through the site's block renderers. Channel items and
 * blocks with no renderer decode to nothing and are skipped.
 */
const toContentBlock = (item: ArenaChannelContents): ArenaContentBlock | null =>
  Option.getOrNull(Schema.decodeUnknownOption(ArenaContentBlockSchema)(item));

function ArenaItem(props: { item: ArenaChannelContents }) {
  const block = createMemo(() => toContentBlock(props.item));
  return <Show when={block()}>{(value) => <ContentBlocks blocks={[value()]} />}</Show>;
}

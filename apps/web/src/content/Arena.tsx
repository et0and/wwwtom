import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/solid-query";
import { Effect, Option, Schema } from "effect";
import { For, Show, createEffect, createMemo } from "solid-js";
import { ArenaContentBlockSchema } from "@tom/schemas/arena-content";
import type { ArenaChannelContents } from "@tom/schemas/arena";
import { colors } from "@tom/ui/colors.stylex";
import { Loader } from "@tom/ui/loader";
import { overflow } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { ContentBlocks } from "~/content/ContentBlocks";
import { fetchChannelContents } from "~/server/adapter";
import { layoutStyles } from "../chrome/layout.stylex";

const styles = stylex.create({
  carouselContainer: {
    overflowX: "auto",
    whiteSpace: "nowrap",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors["--color-black"],
  },
  carouselInner: {
    display: "inline-flex",
    gap: "1rem",
    padding: "1rem",
  },
  carouselItem: {
    width: "20rem",
  },
});

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
  const hasContent = createMemo(() => {
    const response = activeContents();
    return !!(response?.data && response.data.length > 0);
  });
  createEffect(
    () => !contentsQuery.isLoading && !hasContent(),
    (isEmpty) => {
      if (isEmpty) {
        void Effect.runFork(
          Effect.logWarning(`Warning: no contents found for channel slug "${props.slug}"`),
        );
      }
    },
  );
  return (
    <Show when={!contentsQuery.isLoading} fallback={<Loader />}>
      <Show when={hasContent()} fallback={<Text variant="secondary">Sorry, no content found</Text>}>
        <div {...stylex.attrs(styles.carouselContainer)}>
          <div class={`carousel-container ${stylex.attrs(styles.carouselInner).class ?? ""}`}>
            <For each={activeContents()?.data || []} keyed={false}>
              {(item) => (
                <div
                  class={`carousel-item ${stylex.attrs(styles.carouselItem, overflow.noShrink).class ?? ""}`}
                >
                  <ArenaItem item={item()} />
                </div>
              )}
            </For>
          </div>
        </div>
        <Text variant="secondary" size="xs" style={layoutStyles.mt2}>
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
function ArenaItem(props: { item: ArenaChannelContents }) {
  const block = createMemo(() =>
    Option.getOrNull(Schema.decodeOption(ArenaContentBlockSchema)(props.item)),
  );
  return <Show when={block()}>{(value) => <ContentBlocks blocks={[value()]} />}</Show>;
}

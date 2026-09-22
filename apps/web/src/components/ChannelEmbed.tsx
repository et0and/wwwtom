import { For, Show, createMemo } from "solid-js";
import { useQuery } from "@tanstack/solid-query";
import type { ArenaBlockImage, ArenaChannelContents } from "@tom/schemas/arena";
import { Loader } from "@tom/ui/loader";
import { Text } from "@tom/ui/text";
import { fetchChannel, fetchChannelContents } from "~/server/adapter";
import { arenaImageAlt, arenaImageSource, arenaImageSourceSet } from "~/libs/utils/arena-image";

const STRIP_ITEMS = 12;

const itemImage = (item: ArenaChannelContents): ArenaBlockImage | null => {
  if (!("image" in item)) return null;
  return item.image ?? null;
};

const itemText = (item: ArenaChannelContents): string | null => {
  if ("content" in item && item.content) return item.content.plain;
  if (item.type === "Channel") return item.description?.plain ?? null;
  return item.title ?? null;
};

function StripItem(props: { item: ArenaChannelContents }) {
  const image = createMemo(() => itemImage(props.item));
  const text = createMemo(() => itemText(props.item));
  return (
    <Show
      when={image()}
      fallback={
        <Show when={text()}>
          {(value) => (
            <div class="h-44 w-56 shrink-0 overflow-hidden bg-tomui-base p-3 ring-1 ring-tomui-line ring-inset">
              <Text size="sm">{value()}</Text>
            </div>
          )}
        </Show>
      }
    >
      {(value) => (
        <img
          src={arenaImageSource(value())}
          srcset={arenaImageSourceSet(value())}
          alt={arenaImageAlt(value(), null)}
          class="h-44 w-auto shrink-0 object-cover"
          loading="lazy"
        />
      )}
    </Show>
  );
}

interface ChannelLinkProps {
  href: string;
  title: string;
}

function ChannelLink(props: ChannelLinkProps) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      class="no-underline hover:underline"
    >
      <Text variant="heading" as="h3">
        {props.title}
      </Text>
    </a>
  );
}

interface ChannelEmbedProps {
  slug: string;
  title?: string | undefined;
}

/**
 * A channel connected into a post body, drawn like are.na's own channel
 * embed: the channel title and owner on the left, a strip of its contents
 * on the right.
 */
export function ChannelEmbed(props: ChannelEmbedProps) {
  const channelQuery = useQuery(() => ({
    queryKey: ["arena-channel", props.slug],
    queryFn: () => fetchChannel(props.slug),
  }));

  const contentsQuery = useQuery(() => ({
    queryKey: ["arena-contents", props.slug, STRIP_ITEMS],
    queryFn: () => fetchChannelContents(props.slug, STRIP_ITEMS),
  }));

  const heading = () => channelQuery.data?.title ?? props.title ?? props.slug;

  return (
    <div class="flex w-full max-w-full flex-col gap-4 overflow-hidden px-5 py-4 ring-1 ring-tomui-line ring-inset sm:flex-row sm:items-stretch sm:gap-6">
      <div class="flex w-full shrink-0 flex-col justify-center gap-1.5 sm:w-56">
        {/* Nested channels can belong to anyone: link through the channel's
            owner once it is known, and through the site owner before that. */}
        <Show
          when={channelQuery.data}
          fallback={<ChannelLink href={`https://are.na/tom/${props.slug}`} title={heading()} />}
        >
          {(channel) => (
            <ChannelLink
              href={`https://are.na/${channel().owner.slug}/${props.slug}`}
              title={heading()}
            />
          )}
        </Show>
        <Show when={channelQuery.data}>
          {(channel) => (
            <Text variant="secondary" size="sm">
              by {channel().owner.name}
            </Text>
          )}
        </Show>
      </div>
      <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <Show
          when={contentsQuery.data}
          fallback={
            <Show
              when={contentsQuery.isPending}
              fallback={
                <Text variant="secondary" size="sm">
                  Could not load channel
                </Text>
              }
            >
              <Loader />
            </Show>
          }
        >
          {(contents) => <For each={contents().data}>{(item) => <StripItem item={item} />}</For>}
        </Show>
      </div>
    </div>
  );
}

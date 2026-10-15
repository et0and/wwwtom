import { For, Show, createMemo } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/solid-query";
import type { ArenaBlockImage, ArenaChannelContents } from "@tom/schemas/arena";
import { colors } from "@tom/ui/colors.stylex";
import { Loader } from "@tom/ui/loader";
import { overflow } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { fetchChannel, fetchChannelContents } from "~/server/adapter";
import { arenaImageAlt, arenaImageSource, arenaImageSourceSet } from "~/content/arena-image";
import { layoutStyles } from "~/chrome/layout.stylex";

const STRIP_ITEMS = 12;

const SM = "@media (min-width: 640px)";

/** Inset hairline, matching TomUI's `ring ring-tomui-line ring-inset`. */
const ringLine = `inset 0 0 0 1px ${colors["--color-tomui-line"]}`;

const styles = stylex.create({
  placeholderCard: {
    height: "11rem",
    width: "14rem",
    overflow: "clip",
    backgroundColor: colors["--color-tomui-base"],
    padding: "0.75rem",
    boxShadow: ringLine,
  },
  stripImage: {
    height: "11rem",
    width: "auto",
    objectFit: "cover",
  },
  root: {
    display: "flex",
    width: "100%",
    maxWidth: "100%",
    flexDirection: { default: "column", [SM]: "row" },
    alignItems: { default: "normal", [SM]: "stretch" },
    gap: { default: "1rem", [SM]: "1.5rem" },
    overflow: "clip",
    paddingInline: "1.25rem",
    paddingBlock: "1rem",
    boxShadow: ringLine,
  },
  meta: {
    display: "flex",
    width: { default: "100%", [SM]: "14rem" },
    flexShrink: 0,
    flexDirection: "column",
    justifyContent: "center",
    gap: "0.375rem",
  },
  contentsStrip: {
    display: "flex",
    minWidth: 0,
    flex: "1 1 0%",
    alignItems: "center",
    gap: "0.25rem",
    overflowX: "auto",
  },
});

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
            <div {...stylex.attrs(styles.placeholderCard, overflow.noShrink)}>
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
          {...stylex.attrs(styles.stripImage, overflow.noShrink)}
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
      {...stylex.attrs(layoutStyles.noUnderlineHover)}
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
    <div data-slot="channel-embed" {...stylex.attrs(styles.root)}>
      <div {...stylex.attrs(styles.meta)}>
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
      <div {...stylex.attrs(styles.contentsStrip)}>
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

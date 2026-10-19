import { For, Match, Show, Switch, createSignal, onSettled } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { isServer } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import type { ArenaAttachment, ArenaContentBlock, ArenaImage } from "@tom/schemas/arena-content";
import { colors } from "@tom/ui/colors.stylex";
import { layout, cursor, textAlign, spacing, radius } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { sanitizeEmbedHtml, sanitizeRichHtml } from "~/content/sanitize";
import { ChannelEmbed } from "~/content/ChannelEmbed";
import {
  arenaImageAlt,
  arenaImageDimensions,
  arenaImageSource,
  arenaImageSourceSet,
  hasArenaImageSource,
} from "~/content/arena-image";
import { PdfDialog } from "~/content/PdfDialog";
import { layoutStyles } from "~/chrome/layout.stylex";

const DEFAULT_EMBED_ASPECT_RATIO = "16 / 9";

const styles = stylex.create({
  textBlock: { maxWidth: "none", overflowWrap: "break-word", whiteSpace: "normal" },
  figureReset: { margin: 0 },
  /** One are.na block per row, with the rhythm the page has always had. */
  blockRow: { paddingBlock: spacing.py4 },
  playOverlay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    display: "flex",
    height: "3.5rem",
    width: "3.5rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: `color-mix(in srgb, ${colors["--color-black"]} 60%, transparent)`,
    color: colors["--color-white"],
  },
  playIcon: {
    height: "1.5rem",
    width: "1.5rem",
    fill: "currentColor",
  },
  videoTrigger: {
    display: "block",
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: cursor.pointer,
    padding: spacing.p0,
  },
  videoCoverFallback: {
    position: "relative",
    display: "flex",
    height: "11rem",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors["--color-tomui-tint"],
  },
  embedContainer: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors["--color-black"],
  },
});

/**
 * Sanitized third-party HTML. Sanitizing needs DOMParser, which only exists
 * in the browser, so the server renders the fallback and the client swaps in
 * the sanitized markup after mount. Both render the same fallback first, so
 * hydration never mismatches.
 */
function ClientHtml(props: {
  html: string;
  sanitize: (dirty: string) => string;
  fallback: JSX.Element;
  class?: string;
}): JSX.Element {
  const [safe, setSafe] = createSignal<string | null>(null);
  onSettled(() => {
    if (!isServer) setSafe(props.sanitize(props.html));
  });
  return (
    <Show when={safe()} fallback={props.fallback}>
      {(html) => <div class={props.class} innerHTML={html()} />}
    </Show>
  );
}

const embedAspectRatio = (width?: number | null, height?: number | null): string => {
  if (width && height && width > 0 && height > 0) return `${width} / ${height}`;
  return DEFAULT_EMBED_ASPECT_RATIO;
};

type AttachmentKind = "pdf" | "video" | "audio" | "file";

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/i;

/**
 * What an attachment is, decided from the strongest signal available.
 * `content_type` is authoritative when are.na sends one, but it is optional and
 * is not always helpful (uploads can arrive as `application/octet-stream`), so
 * the stored filename decides next.
 *
 * The human title is consulted last and only as a fallback: it is free text, so
 * a video titled "Holiday clip" must still preview rather than quietly become a
 * download link.
 */
const attachmentKind = (attachment: ArenaAttachment, title?: string | null): AttachmentKind => {
  const contentType = (attachment.content_type ?? "").toLowerCase();
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";

  const matchesExtension = (pattern: RegExp): boolean =>
    [attachment.filename, title].some((name) => (name ? pattern.test(name) : false));

  if (matchesExtension(/\.pdf$/i)) return "pdf";
  if (matchesExtension(VIDEO_EXTENSIONS)) return "video";
  if (matchesExtension(AUDIO_EXTENSIONS)) return "audio";
  return "file";
};

const asBlock = <T extends ArenaContentBlock["type"]>(
  block: ArenaContentBlock,
  type: T,
): Extract<ArenaContentBlock, { type: T }> | null =>
  block.type === type ? (block as Extract<ArenaContentBlock, { type: T }>) : null;

function TextBlock(props: { block: Extract<ArenaContentBlock, { type: "Text" }> }) {
  return (
    <div {...stylex.attrs(styles.textBlock)}>
      <ClientHtml
        html={props.block.content.html}
        sanitize={sanitizeRichHtml}
        fallback={<Text>{props.block.content.markdown}</Text>}
      />
    </div>
  );
}

function ImageBlock(props: { block: Extract<ArenaContentBlock, { type: "Image" }> }) {
  const src = () => arenaImageSource(props.block.image);
  return (
    <figure {...stylex.attrs(styles.figureReset)}>
      <Show when={src()}>
        {(value) => (
          <img
            src={value()}
            srcset={arenaImageSourceSet(props.block.image)}
            alt={arenaImageAlt(props.block.image, props.block.title)}
            {...stylex.attrs(layout.fullWidth)}
            loading="lazy"
            {...arenaImageDimensions(props.block.image)}
          />
        )}
      </Show>
      <Show when={props.block.description?.plain}>
        {(caption) => (
          <figcaption>
            <Text variant="secondary" size="sm">
              {caption()}
            </Text>
          </figcaption>
        )}
      </Show>
    </figure>
  );
}

function LinkBlockImage(props: { block: Extract<ArenaContentBlock, { type: "Link" }> }) {
  return (
    <Show when={hasArenaImageSource(props.block.image)}>
      <img
        src={arenaImageSource(props.block.image)}
        srcset={arenaImageSourceSet(props.block.image)}
        alt={arenaImageAlt(props.block.image, props.block.title)}
        {...stylex.attrs(layout.fullWidth)}
        loading="lazy"
        {...arenaImageDimensions(props.block.image)}
      />
    </Show>
  );
}

function LinkBlock(props: { block: Extract<ArenaContentBlock, { type: "Link" }> }) {
  const url = () => props.block.source?.url ?? "";
  const label = () => props.block.title || props.block.source?.title || "";
  return (
    <Show
      when={url()}
      fallback={
        <>
          <LinkBlockImage block={props.block} />
          <Text>{label()}</Text>
        </>
      }
    >
      {(href) => (
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          {...stylex.attrs(layout.block, layoutStyles.noUnderlineHover)}
        >
          <LinkBlockImage block={props.block} />
          <Text>{label()}</Text>
        </a>
      )}
    </Show>
  );
}

function PlayOverlay() {
  return (
    <span {...stylex.attrs(layout.absoluteInset0, styles.playOverlay)}>
      <span {...stylex.attrs(styles.playButton)}>
        <svg viewBox="0 0 24 24" {...stylex.attrs(styles.playIcon)} aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/** Videos load only after a click, so are.na serves no bytes up front. */
function VideoAttachment(props: { url: string; name: string; cover: ArenaImage | null }) {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const cover = () => (props.cover && hasArenaImageSource(props.cover) ? props.cover : null);
  return (
    <Show
      when={isPlaying()}
      fallback={
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`Play ${props.name}`}
          {...stylex.attrs(styles.videoTrigger, layout.fullWidth, textAlign.left)}
        >
          <Show
            when={cover()}
            fallback={
              <span {...stylex.attrs(styles.videoCoverFallback)}>
                <PlayOverlay />
              </span>
            }
          >
            {(cover) => (
              <span {...stylex.attrs(layout.relative, layout.block)}>
                <img
                  src={arenaImageSource(cover())}
                  srcset={arenaImageSourceSet(cover())}
                  alt={props.name}
                  {...stylex.attrs(layout.fullWidth)}
                  loading="lazy"
                  {...arenaImageDimensions(cover())}
                />
                <PlayOverlay />
              </span>
            )}
          </Show>
          <Text>{props.name}</Text>
        </button>
      }
    >
      <video
        src={props.url}
        controls
        preload="metadata"
        {...(cover() ? { poster: arenaImageSource(cover()) } : {})}
        {...stylex.attrs(layout.fullWidth)}
      >
        Your browser does not support the video element.
      </video>
    </Show>
  );
}

/**
 * Audio needs no click-to-load: `preload="metadata"` fetches only the header, so
 * the player can sit inline like any other block. are.na's cover, when it has
 * one, stands in as artwork above it.
 */
function AudioAttachment(props: { url: string; name: string; cover: ArenaImage | null }) {
  const cover = () => (props.cover && hasArenaImageSource(props.cover) ? props.cover : null);
  return (
    <figure {...stylex.attrs(styles.figureReset)}>
      <Show when={cover()}>
        {(artwork) => (
          <img
            src={arenaImageSource(artwork())}
            srcset={arenaImageSourceSet(artwork())}
            alt={props.name}
            {...stylex.attrs(layout.fullWidth)}
            loading="lazy"
            {...arenaImageDimensions(artwork())}
          />
        )}
      </Show>
      <audio src={props.url} controls preload="metadata" {...stylex.attrs(layout.fullWidth)}>
        Your browser does not support the audio element.
      </audio>
      <figcaption>
        <Text>{props.name}</Text>
      </figcaption>
    </figure>
  );
}

function AttachmentBlock(props: { block: Extract<ArenaContentBlock, { type: "Attachment" }> }) {
  const displayName = () =>
    props.block.title || props.block.attachment.filename || "Download attachment";
  const kind = () => attachmentKind(props.block.attachment, props.block.title);
  const body = (
    <>
      <Show when={hasArenaImageSource(props.block.image)}>
        <img
          src={arenaImageSource(props.block.image)}
          srcset={arenaImageSourceSet(props.block.image)}
          alt={displayName()}
          {...stylex.attrs(layout.fullWidth)}
          loading="lazy"
          {...arenaImageDimensions(props.block.image)}
        />
      </Show>
      <Text>{displayName()}</Text>
    </>
  );
  return (
    <Switch
      fallback={
        <a
          href={props.block.attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          {...stylex.attrs(layout.block, layoutStyles.noUnderlineHover)}
        >
          {body}
        </a>
      }
    >
      <Match when={kind() === "video"}>
        <VideoAttachment
          url={props.block.attachment.url}
          name={displayName()}
          cover={props.block.image ?? null}
        />
      </Match>
      <Match when={kind() === "audio"}>
        <AudioAttachment
          url={props.block.attachment.url}
          name={displayName()}
          cover={props.block.image ?? null}
        />
      </Match>
      <Match when={kind() === "pdf"}>
        <PdfDialog url={props.block.attachment.url} title={displayName()}>
          {body}
        </PdfDialog>
      </Match>
    </Switch>
  );
}

/** An embed shows its thumbnail first; the third-party frame loads on click. */
function EmbedBlock(props: { block: Extract<ArenaContentBlock, { type: "Embed" }> }) {
  const embed = () => props.block.embed;
  const cover = () => props.block.image ?? null;
  const fallbackUrl = () => embed().source_url || embed().url || "";
  const [isPlaying, setIsPlaying] = createSignal(false);
  return (
    <Show
      when={embed().html}
      fallback={
        <Show
          when={fallbackUrl()}
          fallback={<Text>{props.block.title || "Embedded content"}</Text>}
        >
          {(href) => (
            <a href={href()} target="_blank" rel="noopener noreferrer">
              {props.block.title || href()}
            </a>
          )}
        </Show>
      }
    >
      {(html) => (
        <Show
          when={isPlaying() || !hasArenaImageSource(cover())}
          fallback={
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              aria-label={`Play ${props.block.title ?? "video"}`}
              {...stylex.attrs(layout.relative, styles.videoTrigger, layout.fullWidth)}
            >
              <span {...stylex.attrs(layout.relative, layout.block)}>
                <img
                  src={arenaImageSource(cover())}
                  srcset={arenaImageSourceSet(cover())}
                  alt={props.block.title ?? ""}
                  {...stylex.attrs(layout.fullWidth)}
                  loading="lazy"
                  {...arenaImageDimensions(cover())}
                />
                <PlayOverlay />
              </span>
            </button>
          }
        >
          <div
            class={`embed-container ${stylex.attrs(styles.embedContainer).class ?? ""}`}
            style={{ "aspect-ratio": embedAspectRatio(embed().width, embed().height) }}
          >
            <ClientHtml html={html()} sanitize={sanitizeEmbedHtml} fallback={null} />
          </div>
        </Show>
      )}
    </Show>
  );
}

/** A channel connected into the body renders as an are.na channel embed. */
function ChannelBlock(props: { block: Extract<ArenaContentBlock, { type: "Channel" }> }) {
  return (
    <ChannelEmbed
      slug={props.block.slug}
      // exactOptionalPropertyTypes: omit the prop instead of passing undefined.
      {...(props.block.title ? { title: props.block.title } : {})}
    />
  );
}

/** A post or work body: are.na blocks stacked in channel order. */
export function ContentBlocks(props: { blocks: ReadonlyArray<ArenaContentBlock> }) {
  return (
    <div class="content-blocks">
      <For each={props.blocks}>
        {(block) => (
          <div {...stylex.attrs(styles.blockRow)}>
            <Switch>
              <Match when={asBlock(block, "Text")}>{(text) => <TextBlock block={text()} />}</Match>
              <Match when={asBlock(block, "Image")}>
                {(image) => <ImageBlock block={image()} />}
              </Match>
              <Match when={asBlock(block, "Link")}>{(link) => <LinkBlock block={link()} />}</Match>
              <Match when={asBlock(block, "Attachment")}>
                {(attachment) => <AttachmentBlock block={attachment()} />}
              </Match>
              <Match when={asBlock(block, "Embed")}>
                {(embed) => <EmbedBlock block={embed()} />}
              </Match>
              <Match when={asBlock(block, "Channel")}>
                {(channel) => <ChannelBlock block={channel()} />}
              </Match>
            </Switch>
          </div>
        )}
      </For>
    </div>
  );
}

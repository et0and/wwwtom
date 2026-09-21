import { For, Match, Show, Switch, createSignal, onSettled } from "solid-js";
import { isServer } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import type { ArenaContentBlock, ArenaImage } from "@tom/schemas/arena-content";
import { Text } from "@tom/ui/text";
import { sanitizeEmbedHtml, sanitizeRichHtml } from "~/libs/utils/sanitize";
import { ChannelEmbed } from "~/components/ChannelEmbed";
import { PdfDialog } from "~/components/PdfDialog";

const DEFAULT_EMBED_ASPECT_RATIO = "16 / 9";

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

const asBlock = <T extends ArenaContentBlock["type"]>(
  block: ArenaContentBlock,
  type: T,
): Extract<ArenaContentBlock, { type: T }> | null =>
  block.type === type ? (block as Extract<ArenaContentBlock, { type: T }>) : null;

const imageSource = (image: ArenaImage | null | undefined): string =>
  image?.medium?.src ?? image?.large?.src ?? image?.src ?? "";

const imageSourceSet = (image: ArenaImage | null | undefined): string | undefined => {
  const version = image?.medium;
  return version?.src_2x ? `${version.src} 1x, ${version.src_2x} 2x` : undefined;
};

const imageAlt = (image: ArenaImage | null | undefined, title: string | null | undefined): string =>
  image?.alt_text || title || "";

function TextBlock(props: { block: Extract<ArenaContentBlock, { type: "Text" }> }) {
  return (
    <div class="prose prose-sm max-w-none break-words whitespace-normal">
      <ClientHtml
        html={props.block.content.html}
        sanitize={sanitizeRichHtml}
        fallback={<Text>{props.block.content.markdown}</Text>}
      />
    </div>
  );
}

function ImageBlock(props: { block: Extract<ArenaContentBlock, { type: "Image" }> }) {
  return (
    <figure class="m-0">
      <img
        src={imageSource(props.block.image)}
        srcset={imageSourceSet(props.block.image)}
        alt={imageAlt(props.block.image, props.block.title)}
        class="w-full"
        loading="lazy"
      />
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

function LinkBlock(props: { block: Extract<ArenaContentBlock, { type: "Link" }> }) {
  return (
    <a
      href={props.block.source?.url ?? ""}
      target="_blank"
      rel="noopener noreferrer"
      class="block no-underline hover:underline"
    >
      <Show when={props.block.image}>
        {(image) => (
          <img
            src={imageSource(image())}
            srcset={imageSourceSet(image())}
            alt={imageAlt(image(), props.block.title)}
            class="w-full"
            loading="lazy"
          />
        )}
      </Show>
      <Text>{props.block.title || props.block.source?.title || ""}</Text>
    </a>
  );
}

function PlayOverlay() {
  return (
    <span class="absolute inset-0 flex items-center justify-center">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white">
        <svg viewBox="0 0 24 24" class="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/** Videos load only after a click, so are.na serves no bytes up front. */
function VideoAttachment(props: { url: string; name: string; cover: ArenaImage | null }) {
  const [isPlaying, setIsPlaying] = createSignal(false);
  return (
    <Show
      when={isPlaying()}
      fallback={
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`Play ${props.name}`}
          class="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        >
          <Show
            when={props.cover}
            fallback={
              <span class="relative flex h-44 w-full items-center justify-center bg-gray-100">
                <PlayOverlay />
              </span>
            }
          >
            {(cover) => (
              <span class="relative block">
                <img
                  src={imageSource(cover())}
                  srcset={imageSourceSet(cover())}
                  alt={props.name}
                  class="w-full"
                  loading="lazy"
                />
                <PlayOverlay />
              </span>
            )}
          </Show>
          <Text>{props.name}</Text>
        </button>
      }
    >
      <video src={props.url} controls preload="metadata" class="w-full">
        Your browser does not support the video element.
      </video>
    </Show>
  );
}

function AttachmentBlock(props: { block: Extract<ArenaContentBlock, { type: "Attachment" }> }) {
  const displayName = () =>
    props.block.title || props.block.attachment.filename || "Download attachment";
  const contentType = () => props.block.attachment.content_type ?? "";
  const isPdf = () =>
    contentType() === "application/pdf" || displayName().toLowerCase().endsWith(".pdf");
  const isVideo = () =>
    contentType().startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(displayName());
  const body = (
    <>
      <Show when={props.block.image}>
        {(cover) => (
          <img
            src={imageSource(cover())}
            srcset={imageSourceSet(cover())}
            alt={displayName()}
            class="w-full"
            loading="lazy"
          />
        )}
      </Show>
      <Text>{displayName()}</Text>
    </>
  );
  return (
    <Show
      when={isVideo()}
      fallback={
        <Show
          when={isPdf()}
          fallback={
            <a
              href={props.block.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              class="block no-underline hover:underline"
            >
              {body}
            </a>
          }
        >
          <PdfDialog url={props.block.attachment.url} title={displayName()}>
            {body}
          </PdfDialog>
        </Show>
      }
    >
      <VideoAttachment
        url={props.block.attachment.url}
        name={displayName()}
        cover={props.block.image ?? null}
      />
    </Show>
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
        <a href={fallbackUrl()} target="_blank" rel="noopener noreferrer">
          {props.block.title || fallbackUrl()}
        </a>
      }
    >
      {(html) => (
        <Show
          when={isPlaying() || !cover()}
          fallback={
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              aria-label={`Play ${props.block.title ?? "video"}`}
              class="relative block w-full cursor-pointer border-0 bg-transparent p-0"
            >
              <span class="relative block">
                <img
                  src={imageSource(cover())}
                  srcset={imageSourceSet(cover())}
                  alt={props.block.title ?? ""}
                  class="w-full"
                  loading="lazy"
                />
                <PlayOverlay />
              </span>
            </button>
          }
        >
          <div
            class="embed-container relative w-full overflow-hidden bg-black"
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
          <div class="py-4">
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

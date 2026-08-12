import { useQuery } from "@tanstack/solid-query";
import { Effect } from "effect";
import { Show, Index, createMemo, createSignal } from "solid-js";
import { fetchChannelContents } from "~/server/adapter";
import type { ArenaBlock, ArenaChannelContents } from "@tom/schemas/arena";
import { Spinner } from "@tom/ui/Spinner";
import { decodeBlurhash } from "~/libs/utils/blurhash";

interface ArenaCarouselProps {
  slug: string;
  title?: string;
}

const asBlock = <T extends ArenaBlock["type"]>(
  block: ArenaBlock,
  type: T,
): Extract<ArenaBlock, { type: T }> | null =>
  block.type === type ? (block as Extract<ArenaBlock, { type: T }>) : null;

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mpg4"]);

const DEFAULT_EMBED_ASPECT_RATIO = "16 / 9";

const embedAspectRatio = (width?: number | null, height?: number | null): string => {
  if (width && height && width > 0 && height > 0) return `${width} / ${height}`;
  return DEFAULT_EMBED_ASPECT_RATIO;
};

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
    <Show when={!isLoading()} fallback={<Spinner />}>
      <Show
        when={hasContent()}
        fallback={
          <>
            {
              void Effect.runFork(
                Effect.logWarning(`Warning: no contents found for channel slug "${props.slug}"`),
              )
            }
            <p>Sorry, no content found</p>
          </>
        }
      >
        <div class="overflow-x-auto whitespace-nowrap border border-black">
          <div class="carousel-container inline-flex gap-4 p-4">
            <Index each={activeContents()?.data || []}>
              {(item) => (
                <div class="carousel-item flex-shrink-0 w-80">
                  <ArenaItem item={item()} />
                </div>
              )}
            </Index>
          </div>
        </div>
        <p class="text-xs mt-2">
          Source:{" "}
          <a href={`https://are.na/tom/${props.slug}`} target="_blank" rel="noopener noreferrer">
            {props.title || props.slug}
          </a>
        </p>
      </Show>
    </Show>
  );
}

interface ArenaItemProps {
  item: ArenaChannelContents;
}

function ArenaItem(props: ArenaItemProps) {
  const item = () => props.item;

  return (
    <Show when={"base_type" in item()}>
      <ArenaBlockItem block={item() as ArenaBlock} />
    </Show>
  );
}

interface ImageBlockProps {
  block: Extract<ArenaBlock, { type: "Image" }>;
}

function ImageBlock(props: ImageBlockProps) {
  const block = () => props.block;
  const [loaded, setLoaded] = createSignal(false);

  const blurhashDataUrl = createMemo(() => Effect.runSync(decodeBlurhash(block().image?.blurhash)));

  return (
    <div class="image-block relative w-full h-60 bg-gray-100" data-block-id={block().id}>
      <Show when={blurhashDataUrl() && !loaded()}>
        <img
          src={blurhashDataUrl()!}
          alt=""
          class="absolute inset-0 w-full h-full object-cover blur-sm"
        />
      </Show>
      <img
        src={block().image?.medium.src}
        srcset={
          block().image?.medium.src_2x
            ? `${block().image?.medium.src} 1x, ${block().image?.medium.src_2x} 2x`
            : undefined
        }
        alt={block().image?.alt_text || block().title || ""}
        class="w-full h-full object-cover"
        classList={{ "opacity-0": !!blurhashDataUrl() && !loaded() }}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </div>
  );
}

interface ArenaBlockItemProps {
  block: ArenaBlock;
}

function ArenaBlockItem(props: ArenaBlockItemProps) {
  const block = () => props.block;

  return (
    <div class="arena-block p-4">
      <Show when={asBlock(block(), "Image")}>{(img) => <ImageBlock block={img()} />}</Show>
      <Show when={asBlock(block(), "Text")}>
        {(text) =>
          text().content?.html ? (
            <div class="text-content prose prose-sm break-words whitespace-normal">
              <div innerHTML={text().content.html} />
            </div>
          ) : (
            <div class="text-content prose prose-sm break-words whitespace-normal">
              <p>{text().content?.markdown}</p>
            </div>
          )
        }
      </Show>
      <Show when={asBlock(block(), "Link")}>{(link) => <LinkBlock block={link()} />}</Show>
      <Show when={asBlock(block(), "Attachment")}>
        {(attachment) => <AttachmentBlock block={attachment()} />}
      </Show>
      <Show when={asBlock(block(), "Embed")}>{(embed) => <EmbedBlock block={embed()} />}</Show>
    </div>
  );
}

interface EmbedBlockProps {
  block: Extract<ArenaBlock, { type: "Embed" }>;
}

function EmbedBlock(props: EmbedBlockProps) {
  const block = () => props.block;
  const [isPlaying, setIsPlaying] = createSignal(false);

  const embed = () => block().embed;
  const embedHtml = () => embed().html ?? "";
  const thumbnail = () => block().image;
  const fallbackUrl = () => embed().source_url || embed().url || block().source?.url || "";

  return (
    <div class="media-content">
      <Show
        when={embed().html}
        fallback={<EmbedFallbackLink url={fallbackUrl()} title={block().title} />}
      >
        <Show when={isPlaying() || !thumbnail()}>
          <div
            class="embed-container relative w-full bg-black overflow-hidden"
            style={{ "aspect-ratio": embedAspectRatio(embed().width, embed().height) }}
          >
            <div class="embed-html" innerHTML={embedHtml()} />
          </div>
        </Show>
        <Show when={!isPlaying() && thumbnail()}>
          <button
            type="button"
            class="embed-poster relative block w-full p-0 border-0 cursor-pointer"
            onClick={() => setIsPlaying(true)}
            aria-label={`Play ${block().title || "video"}`}
          >
            <div class="relative w-full h-60 bg-gray-100">
              <img
                src={thumbnail()?.medium.src}
                srcset={
                  thumbnail()?.medium.src_2x
                    ? `${thumbnail()?.medium.src} 1x, ${thumbnail()?.medium.src_2x} 2x`
                    : undefined
                }
                alt={block().title || ""}
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="play-button flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white">
                  <svg viewBox="0 0 24 24" class="h-6 w-6 fill-current" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        </Show>
      </Show>
    </div>
  );
}

interface EmbedFallbackLinkProps {
  url: string;
  title?: string | null | undefined;
}

function EmbedFallbackLink(props: EmbedFallbackLinkProps) {
  return (
    <a
      href={props.url}
      target="_blank"
      rel="noopener noreferrer"
      class="block no-underline hover:underline break-words whitespace-normal"
    >
      {props.title}
    </a>
  );
}

interface LinkBlockProps {
  block: Extract<ArenaBlock, { type: "Link" }>;
}

function LinkBlock(props: LinkBlockProps) {
  const block = () => props.block;

  return (
    <a
      href={block().source?.url || ""}
      target="_blank"
      rel="noopener noreferrer"
      class="block no-underline hover:underline"
    >
      <Show when={block().image}>
        <div class="relative w-full h-60 bg-gray-100">
          <img
            src={block().image?.medium.src}
            srcset={
              block().image?.medium.src_2x
                ? `${block().image?.medium.src} 1x, ${block().image?.medium.src_2x} 2x`
                : undefined
            }
            alt={block().title || ""}
            class="w-full h-full object-cover"
            onError={() => void Effect.runFork(Effect.logError("Failed to load arena link image"))}
            loading="lazy"
          />
        </div>
      </Show>
      <div class="link-title mt-2 text-sm break-words whitespace-normal">
        <p>{block().title || block().source?.title || ""}</p>
      </div>
    </a>
  );
}

interface AttachmentBlockProps {
  block: Extract<ArenaBlock, { type: "Attachment" }>;
}

function AttachmentBlock(props: AttachmentBlockProps) {
  const block = () => props.block;

  const attachment = () => block().attachment;
  const fileExtension = () => (attachment()?.file_extension || "").toLowerCase();
  const displayName = () => block().title || attachment()?.filename || "";
  const fileUrl = () => attachment()?.url || "";
  const isAudio = () =>
    AUDIO_EXTENSIONS.has(fileExtension()) ||
    (attachment()?.content_type || "").startsWith("audio/");
  const isVideo = () =>
    VIDEO_EXTENSIONS.has(fileExtension()) ||
    (attachment()?.content_type || "").startsWith("video/");

  return (
    <div class="attachment-block">
      <Show when={isAudio() || isVideo()}>
        <div class="media-container relative w-full h-60 bg-black">
          <Show when={isAudio()}>
            <audio src={fileUrl()} controls class="w-full h-full">
              Your browser does not support the audio element.
            </audio>
          </Show>

          <Show when={isVideo()}>
            <video src={fileUrl()} controls class="w-full h-full object-contain">
              Your browser does not support the video element.
            </video>
          </Show>
        </div>
      </Show>

      <Show when={!isAudio() && !isVideo()}>
        <a
          href={fileUrl()}
          target="_blank"
          rel="noopener noreferrer"
          class="block no-underline hover:underline"
        >
          <Show when={block().image}>
            <div class="relative w-full h-60 bg-gray-100">
              <img
                src={block().image?.medium.src}
                srcset={
                  block().image?.medium.src_2x
                    ? `${block().image?.medium.src} 1x, ${block().image?.medium.src_2x} 2x`
                    : undefined
                }
                alt={displayName()}
                class="w-full h-full object-cover"
                onError={() =>
                  void Effect.runFork(Effect.logError("Failed to load arena attachment thumbnail"))
                }
                loading="lazy"
              />
            </div>
          </Show>
          <div class="attachment p-2 border border-gray-300 text-sm break-words whitespace-normal">
            {displayName()}
            <div class="file-size text-xs text-gray-600">
              {formatFileSize(attachment()?.file_size)}
            </div>
          </div>
        </a>
      </Show>
    </div>
  );
}

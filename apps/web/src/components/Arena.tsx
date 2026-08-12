import { useQuery } from "@tanstack/solid-query";
import { Effect } from "effect";
import { Show, Index, createMemo, createSignal, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { Motion } from "solid-motionone";
import { fetchChannelContents } from "~/server/adapter";
import type { ArenaBlock, ArenaChannelContents } from "@tom/schemas/arena";
import { Spinner } from "@tom/ui/Spinner";
import { decodeBlurhash } from "~/libs/utils/blurhash";

interface ArenaCarouselProps {
  slug: string;
  title?: string;
}

type ArenaImageBlock = Extract<ArenaBlock, { type: "Image" }>;

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
  const [expandedBlock, setExpandedBlock] = createSignal<ArenaImageBlock | null>(null);
  const [isClosing, setIsClosing] = createSignal(false);

  const openLightbox = (block: ArenaBlock) => {
    const image = asBlock(block, "Image");
    if (!image) return;
    setExpandedBlock(image);
  };

  const closeLightbox = () => {
    setIsClosing(true);
  };

  const handleAnimationComplete = () => {
    if (isClosing()) {
      setExpandedBlock(null);
      setIsClosing(false);
    }
  };

  createEffect(() => {
    if (isServer) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedBlock() && !isClosing()) {
        closeLightbox();
      }
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
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
        <ImageLightbox
          block={expandedBlock()}
          isClosing={isClosing()}
          onClose={closeLightbox}
          onAnimationComplete={handleAnimationComplete}
        />
        <div class="overflow-x-auto whitespace-nowrap border border-black">
          <div class="carousel-container inline-flex gap-4 p-4">
            <Index each={activeContents()?.data || []}>
              {(item) => (
                <div class="carousel-item flex-shrink-0 w-80">
                  <ArenaItem item={item()} onExpand={openLightbox} />
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

interface ImageLightboxProps {
  block: ArenaImageBlock | null;
  isClosing: boolean;
  onClose: () => void;
  onAnimationComplete: () => void;
}

function ImageLightbox(props: ImageLightboxProps) {
  const [isLoading, setIsLoading] = createSignal(true);

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && !props.isClosing) {
      props.onClose();
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  return (
    <Show when={props.block} keyed>
      {(block) => (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleBackdropClick}
        >
          <Show when={isLoading()}>
            <div class="absolute inset-0 flex items-center justify-center z-10">
              <Spinner color="white" class="h-8 w-8" />
            </div>
          </Show>
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={props.isClosing ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, easing: "ease-out" }}
            onMotionComplete={props.onAnimationComplete}
            class="relative max-w-[90vw] max-h-[90vh]"
          >
            <div class="relative">
              <img
                ref={(el) => {
                  if (el?.complete) {
                    handleImageLoad();
                  }
                }}
                src={block.image?.large.src}
                srcset={
                  block.image?.large.src_2x
                    ? `${block.image?.large.src} 1x, ${block.image?.large.src_2x} 2x`
                    : undefined
                }
                alt={block.title || ""}
                class="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                onLoad={handleImageLoad}
              />
            </div>
          </Motion.div>
        </div>
      )}
    </Show>
  );
}

interface ArenaItemProps {
  item: ArenaChannelContents;
  onExpand: (block: ArenaBlock, imgElement: HTMLImageElement) => void;
}

function ArenaItem(props: ArenaItemProps) {
  const item = () => props.item;

  return (
    <Show when={"base_type" in item()}>
      <ArenaBlockItem block={item() as ArenaBlock} onExpand={props.onExpand} />
    </Show>
  );
}

interface ImageBlockProps {
  block: ArenaImageBlock;
  onExpand: (block: ArenaImageBlock, imgElement: HTMLImageElement) => void;
}

function ImageBlock(props: ImageBlockProps) {
  const block = () => props.block;
  let imgRef: HTMLImageElement | undefined;
  const [loaded, setLoaded] = createSignal(false);

  const blurhashDataUrl = createMemo(() => Effect.runSync(decodeBlurhash(block().image?.blurhash)));

  const handleClick = () => {
    if (imgRef) {
      props.onExpand(block(), imgRef);
    }
  };

  return (
    <div
      class="image-block relative w-full h-60 bg-gray-100 cursor-pointer pointer-events-auto"
      data-block-id={block().id}
      onClick={handleClick}
    >
      <Show when={blurhashDataUrl() && !loaded()}>
        <img
          src={blurhashDataUrl()!}
          alt=""
          class="absolute inset-0 w-full h-full object-cover blur-sm"
        />
      </Show>
      <img
        ref={(el) => {
          imgRef = el;
        }}
        src={block().image?.medium.src}
        srcset={
          block().image?.medium.src_2x
            ? `${block().image?.medium.src} 1x, ${block().image?.medium.src_2x} 2x`
            : undefined
        }
        alt={block().image?.alt_text || block().title || ""}
        class="w-full h-full object-cover pointer-events-none"
        classList={{ "opacity-0": !!blurhashDataUrl() && !loaded() }}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </div>
  );
}

interface ArenaBlockItemProps {
  block: ArenaBlock;
  onExpand: (block: ArenaBlock, imgElement: HTMLImageElement) => void;
}

function ArenaBlockItem(props: ArenaBlockItemProps) {
  const block = () => props.block;

  return (
    <div class="arena-block p-4">
      <Show when={asBlock(block(), "Image")}>
        {(img) => <ImageBlock block={img()} onExpand={props.onExpand} />}
      </Show>
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
      <Show when={asBlock(block(), "Embed")}>
        {(embed) => (
          <div class="media-content">
            {(() => {
              const embedData = embed().embed;
              if (embedData?.html) {
                return <div innerHTML={embedData.html} />;
              }
              return (
                <a
                  href={embed().source?.url || ""}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block no-underline hover:underline"
                >
                  {embed().title}
                </a>
              );
            })()}
          </div>
        )}
      </Show>
    </div>
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

  const fileName = () => block().attachment?.filename || "";
  const fileUrl = () => block().attachment?.url || "";
  const isAudio = () => fileName().toLowerCase().endsWith(".mp3");
  const isVideo = () => fileName().toLowerCase().endsWith(".mp4");

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
          download={fileName()}
          class="block no-underline hover:underline"
          onError={() =>
            void Effect.runFork(Effect.logError("Failed to load arena media attachment"))
          }
        >
          <div class="attachment p-2 border border-gray-300 text-sm">
            {fileName()}
            <div class="file-size text-xs text-gray-600">
              {formatFileSize(block().attachment?.file_size)}
            </div>
          </div>
        </a>
      </Show>
    </div>
  );
}

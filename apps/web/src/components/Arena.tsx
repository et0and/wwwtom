import { createAsync } from "@solidjs/router";
import { Effect } from "effect";
import { Show, Index, createEffect, createMemo, createSignal } from "solid-js";
import { Motion } from "solid-motionone";
import { getChannelContents } from "~/libs/actions/arena/channels";
import type { ArenaBlock, ArenaChannelContents } from "@tom/arena";
import type { GetChannelContentsApiResponse } from "@tom/schemas";
import { Spinner } from "@tom/ui";
import { decodeBlurhash } from "~/libs/utils/blurhash";

interface ArenaCarouselProps {
  slug: string;
  title?: string;
}

const getPublicChannelContents = async (
  slug: string,
  per: number,
): Promise<GetChannelContentsApiResponse> => {
  const response = await fetch(
    `https://api.are.na/v3/channels/${slug}/contents?per_page=${per}&sort=position_desc`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Are.na public fetch failed for slug "${slug}" with status ${response.status}`);
  }
  return (await response.json()) as GetChannelContentsApiResponse;
};

export function ArenaCarousel(props: ArenaCarouselProps) {
  const contents = createAsync(async () => {
    try {
      return await getChannelContents(props.slug, { per: 10 });
    } catch (error) {
      void Effect.runFork(
        Effect.logWarning(
          `[arena] getChannelContents failed for slug "${props.slug}"; returning null for client fallback`,
        ),
      );
      return null;
    }
  });

  const [fallbackData, setFallbackData] = createSignal<GetChannelContentsApiResponse | null>(null);
  const [isFallbackLoading, setIsFallbackLoading] = createSignal(false);
  const [fallbackError, setFallbackError] = createSignal<Error | null>(null);
  const [didFallbackAttempt, setDidFallbackAttempt] = createSignal(false);

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (didFallbackAttempt()) return;
    const response = contents();
    if (response === undefined) return;
    if (response?.data && response.data.length > 0) return;

    setDidFallbackAttempt(true);
    setIsFallbackLoading(true);
    void getPublicChannelContents(props.slug, 10)
      .then((data) => {
        setFallbackData(data);
      })
      .catch((error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        setFallbackError(err);
        void Effect.runFork(
          Effect.logWarning(
            `[arena] client fallback failed for slug "${props.slug}": ${err.message}`,
          ),
        );
      })
      .finally(() => {
        setIsFallbackLoading(false);
      });
  });

  const activeContents = createMemo(() => {
    const response = contents();
    if (response?.data && response.data.length > 0) return response;
    const fallback = fallbackData();
    if (fallback?.data && fallback.data.length > 0) return fallback;
    if (response !== undefined) return response;
    return fallback;
  });

  const isLoading = createMemo(() => contents() === undefined || isFallbackLoading());

  const hasContent = createMemo(() => {
    const response = activeContents();
    return !!(response?.data && response.data.length > 0);
  });
  const [expandedBlock, setExpandedBlock] = createSignal<ArenaBlock | null>(null);
  const [isClosing, setIsClosing] = createSignal(false);

  const openLightbox = (block: ArenaBlock) => {
    if (!block.image) return;
    setExpandedBlock(block);
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && expandedBlock() && !isClosing()) {
      closeLightbox();
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", handleKeyDown);
  }

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
            {fallbackError()
              ? void Effect.runFork(
                  Effect.logWarning(
                    `[arena] both server and client fetch failed for slug "${props.slug}"`,
                  ),
                )
              : null}
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
  block: ArenaBlock | null;
  isClosing: boolean;
  onClose: () => void;
  onAnimationComplete: () => void;
}

function ImageLightbox(props: ImageLightboxProps) {
  const [isLoading, setIsLoading] = createSignal(true);
  let imgRef: HTMLImageElement | undefined;

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
                  imgRef = el;
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
                alt={block.title || block.generated_title || ""}
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
    <Show when={item().base_type === "Block"}>
      <ArenaBlockItem block={item() as ArenaBlock} onExpand={props.onExpand} />
    </Show>
  );
}

interface ImageBlockProps {
  block: ArenaBlock;
  onExpand: (block: ArenaBlock, imgElement: HTMLImageElement) => void;
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
        alt={block().image?.alt_text || block().title || block().generated_title || ""}
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
      <Show when={block().type === "Image"}>
        <ImageBlock block={block()} onExpand={props.onExpand} />
      </Show>
      <Show when={block().type === "Text"}>
        <div class="text-content prose prose-sm break-words whitespace-normal">
          {block().content?.html ? (
            <div innerHTML={block().content?.html || ""} />
          ) : (
            <p>{block().content?.markdown}</p>
          )}
        </div>
      </Show>
      <Show when={block().type === "Link"}>
        <LinkBlock block={block()} />
      </Show>
      <Show when={block().type === "Attachment"}>
        <AttachmentBlock block={block()} />
      </Show>
      <Show when={block().type === "Embed"}>
        <div class="media-content">
          {(() => {
            const embed = block().embed;
            if (embed?.html) {
              return <div innerHTML={embed.html} />;
            }
            return (
              <a
                href={block().source?.url || ""}
                target="_blank"
                rel="noopener noreferrer"
                class="block no-underline hover:underline"
              >
                {block().title || block().generated_title}
              </a>
            );
          })()}
        </div>
      </Show>
    </div>
  );
}

interface LinkBlockProps {
  block: ArenaBlock;
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
            alt={block().title || block().generated_title || ""}
            class="w-full h-full object-cover"
            onError={() => void Effect.runFork(Effect.logError("Failed to load arena link image"))}
            loading="lazy"
          />
        </div>
      </Show>
      <div class="link-title mt-2 text-sm break-words whitespace-normal">
        <p>{block().title || block().source?.title || block().generated_title}</p>
      </div>
    </a>
  );
}

interface AttachmentBlockProps {
  block: ArenaBlock;
}

function AttachmentBlock(props: AttachmentBlockProps) {
  const block = () => props.block;

  const fileName = () => block().attachment?.file_name || "";
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
              {block().attachment?.file_size_display}
            </div>
          </div>
        </a>
      </Show>
    </div>
  );
}

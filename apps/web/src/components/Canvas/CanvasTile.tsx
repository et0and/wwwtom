import { Effect } from "effect";
import { Show, createMemo, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { ArenaBlock, ArenaChannelContents } from "@tom/schemas/arena";
import { decodeBlurhash } from "~/libs/utils/blurhash";
import { canvasLinkHost, colorHashForTitle } from "~/libs/canvas/layout";
import type { CanvasLayoutItem, CanvasTileLayout } from "~/libs/canvas/layout";
import { formatFileSize } from "~/components/Arena";

export const describeCanvasItem = (item: ArenaChannelContents): CanvasLayoutItem => {
  if (!("base_type" in item)) {
    return { id: String(item.id), kind: "Channel", ratio: null };
  }
  const block = item as ArenaBlock;
  const image =
    block.type === "Image"
      ? block.image
      : block.type === "Link" || block.type === "Attachment" || block.type === "Embed"
        ? (block.image ?? null)
        : null;
  return { id: String(block.id), kind: block.type, ratio: ratioFor(image) };
};

const ratioFor = (
  image:
    | {
        readonly aspect_ratio?: number | null;
        readonly width?: number | null;
        readonly height?: number | null;
      }
    | null
    | undefined,
): number | null => {
  if (image?.aspect_ratio) return image.aspect_ratio;
  if (image?.width && image?.height) return image.width / image.height;
  return null;
};

const asBlock = <T extends ArenaBlock["type"]>(
  block: ArenaBlock,
  type: T,
): Extract<ArenaBlock, { type: T }> | null =>
  block.type === type ? (block as Extract<ArenaBlock, { type: T }>) : null;

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"]);

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mpg4"]);

export interface TileFrame {
  readonly style: JSX.CSSProperties;
  readonly label: string;
}

const tileFrame = (layout: CanvasTileLayout, label: string): TileFrame => ({
  label,
  style: {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    transform: `rotate(${layout.rotate}deg)`,
    "content-visibility": "auto",
    "contain-intrinsic-size": "300px 240px",
  },
});

interface CanvasTileProps {
  item: ArenaChannelContents;
  layout: CanvasTileLayout;
  onOpen: (block: ArenaBlock) => void;
}

export function CanvasTile(props: CanvasTileProps) {
  const item = () => props.item;
  const layout = () => props.layout;
  return (
    <Show when={"base_type" in item()}>
      <BlockTile block={item() as ArenaBlock} layout={layout()} onOpen={props.onOpen} />
    </Show>
  );
}

interface BlockTileProps {
  block: ArenaBlock;
  layout: CanvasTileLayout;
  onOpen: (block: ArenaBlock) => void;
}

function BlockTile(props: BlockTileProps) {
  const block = () => props.block;
  const layout = () => props.layout;
  const frame = createMemo(() =>
    tileFrame(layout(), block().title || `${block().type} ${block().id}`),
  );
  const open = (): void => props.onOpen(block());
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
  return (
    <div
      role="button"
      tabindex="0"
      aria-label={frame().label}
      class="absolute cursor-pointer select-none overflow-hidden rounded-xl border border-black/10 bg-white shadow-md transition-shadow hover:shadow-xl dark:border-white/10 dark:bg-neutral-900"
      style={frame().style}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <Show when={asBlock(block(), "Image")}>{(image) => <ImageTileBody block={image()} />}</Show>
      <Show when={asBlock(block(), "Text")}>{(text) => <TextTileBody block={text()} />}</Show>
      <Show when={asBlock(block(), "Link")}>{(link) => <LinkTileBody block={link()} />}</Show>
      <Show when={asBlock(block(), "Attachment")}>
        {(attachment) => <AttachmentTileBody block={attachment()} />}
      </Show>
      <Show when={asBlock(block(), "Embed")}>{(embed) => <EmbedTileBody block={embed()} />}</Show>
      <Show when={block().type === "PendingBlock"}>
        <PendingTileBody title={block().title} />
      </Show>
    </div>
  );
}

interface ChannelTileProps {
  slug: string;
  title: string;
  layout: CanvasTileLayout;
}

export function ChannelTile(props: ChannelTileProps) {
  const layout = () => props.layout;
  const frame = createMemo(() => tileFrame(layout(), props.title));
  return (
    <a
      href={`/canvas/${props.slug}`}
      aria-label={`Open canvas ${props.title}`}
      class="absolute block select-none overflow-hidden rounded-xl border border-dashed border-black/20 bg-neutral-50 p-3 shadow-sm transition-shadow hover:shadow-xl dark:border-white/20 dark:bg-neutral-900"
      style={frame().style}
    >
      <p class="text-xs uppercase tracking-wide opacity-60">Channel</p>
      <p class="mt-1 text-sm font-medium leading-snug">{props.title}</p>
      <p class="mt-2 text-xs underline">Open canvas</p>
    </a>
  );
}

function ImageTileBody(props: { block: Extract<ArenaBlock, { type: "Image" }> }) {
  const block = () => props.block;
  const [loaded, setLoaded] = createSignal(false);
  const placeholder = createMemo(() => Effect.runSync(decodeBlurhash(block().image?.blurhash)));
  return (
    <div class="relative h-full w-full bg-gray-100 dark:bg-neutral-800">
      <Show when={placeholder() && !loaded()}>
        <img
          src={placeholder()!}
          alt=""
          aria-hidden="true"
          class="absolute inset-0 h-full w-full object-cover blur-sm"
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
        class={`h-full w-full object-cover ${placeholder() && !loaded() ? "opacity-0" : ""}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function TextTileBody(props: { block: Extract<ArenaBlock, { type: "Text" }> }) {
  const block = () => props.block;
  const background = createMemo(() =>
    Effect.runSync(colorHashForTitle(block().title || `text-${block().id}`)),
  );
  const excerpt = createMemo(() => (block().content?.markdown ?? "").slice(0, 280));
  return (
    <div class="h-full w-full overflow-hidden p-3" style={{ "background-color": background() }}>
      <Show when={block().title}>
        <p class="text-sm font-medium leading-snug">{block().title}</p>
      </Show>
      <p class="mt-1 line-clamp-6 text-xs leading-relaxed">{excerpt()}</p>
    </div>
  );
}

function LinkTileBody(props: { block: Extract<ArenaBlock, { type: "Link" }> }) {
  const block = () => props.block;
  const host = createMemo(() =>
    Effect.runSync(
      canvasLinkHost(block().source?.url ?? "").pipe(Effect.catch(() => Effect.succeed(""))),
    ),
  );
  return (
    <div class="flex h-full w-full flex-col bg-white dark:bg-neutral-900">
      <Show when={block().image}>
        <div class="relative min-h-0 flex-1 bg-gray-100 dark:bg-neutral-800">
          <img
            src={block().image?.medium.src}
            srcset={
              block().image?.medium.src_2x
                ? `${block().image?.medium.src} 1x, ${block().image?.medium.src_2x} 2x`
                : undefined
            }
            alt=""
            aria-hidden="true"
            class="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      </Show>
      <div class="p-2">
        <p class="truncate text-xs font-medium">
          {block().title || block().source?.title || host()}
        </p>
        <Show when={host()}>
          <p class="truncate text-[11px] opacity-60">{host()}</p>
        </Show>
      </div>
    </div>
  );
}

function AttachmentTileBody(props: { block: Extract<ArenaBlock, { type: "Attachment" }> }) {
  const block = () => props.block;
  const attachment = () => block().attachment;
  const extension = () => (attachment()?.file_extension || "").toLowerCase();
  const contentType = () => attachment()?.content_type || "";
  const fileUrl = () => attachment()?.url || "";
  const displayName = () => block().title || attachment()?.filename || "";
  const isAudio = () => AUDIO_EXTENSIONS.has(extension()) || contentType().startsWith("audio/");
  const isVideo = () => VIDEO_EXTENSIONS.has(extension()) || contentType().startsWith("video/");
  const background = createMemo(() =>
    Effect.runSync(colorHashForTitle(displayName() || `file-${block().id}`)),
  );
  return (
    <Show
      when={isAudio() || isVideo()}
      fallback={
        <div
          class="flex h-full w-full flex-col justify-between p-3"
          style={{ "background-color": background() }}
        >
          <Show when={block().image}>
            <img
              src={block().image?.medium.src}
              alt=""
              aria-hidden="true"
              class="mb-2 max-h-2/3 w-full flex-1 object-cover"
              loading="lazy"
              decoding="async"
            />
          </Show>
          <div>
            <p class="break-words text-xs font-medium">{displayName()}</p>
            <p class="text-[11px] opacity-60">{formatFileSize(attachment()?.file_size)}</p>
          </div>
        </div>
      }
    >
      <Show when={isAudio()}>
        <div
          class="flex h-full w-full flex-col justify-center gap-2 p-3"
          style={{ "background-color": background() }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <p class="truncate text-xs font-medium">{displayName()}</p>
          <audio src={fileUrl()} controls preload="none" class="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
      </Show>
      <Show when={isVideo()}>
        <div
          class="h-full w-full bg-black"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <video src={fileUrl()} controls preload="metadata" class="h-full w-full">
            Your browser does not support the video element.
          </video>
        </div>
      </Show>
    </Show>
  );
}

function EmbedTileBody(props: { block: Extract<ArenaBlock, { type: "Embed" }> }) {
  const block = () => props.block;
  return (
    <div class="relative h-full w-full bg-black">
      <Show
        when={block().image}
        fallback={
          <div class="flex h-full w-full items-center justify-center p-3">
            <p class="text-center text-xs text-white">{block().title || "Embed"}</p>
          </div>
        }
      >
        <img
          src={block().image?.medium.src}
          srcset={
            block().image?.medium.src_2x
              ? `${block().image?.medium.src} 1x, ${block().image?.medium.src_2x} 2x`
              : undefined
          }
          alt=""
          aria-hidden="true"
          class="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </Show>
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <Show when={block().title}>
        <p class="absolute inset-x-0 bottom-0 truncate bg-black/60 p-1 text-[11px] text-white">
          {block().title}
        </p>
      </Show>
    </div>
  );
}

function PendingTileBody(props: { title?: string | null | undefined }) {
  const background = createMemo(() => Effect.runSync(colorHashForTitle(props.title || "pending")));
  return (
    <div
      class="flex h-full w-full items-center justify-center p-3"
      style={{ "background-color": background() }}
    >
      <p class="text-center text-xs">{props.title || "Processing block"}</p>
    </div>
  );
}

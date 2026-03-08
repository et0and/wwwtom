import { createAsync } from "@solidjs/router";
import { Effect } from "effect";
import { Show, Index, createMemo, createSignal } from "solid-js";
import { getChannelContents } from "~/libs/actions/arena/channels";
import type { ArenaBlock, ArenaChannelContents } from "@tom/arena";
import { Spinner } from "@tom/ui";
import { decodeBlurhash } from "~/libs/utils/blurhash";

interface CameraRollProps {
  slug: string;
  title?: string;
}

interface BlockLayout {
  width: string;
  height: string;
  top: string;
  left: string;
  zIndex: number;
  rotation: number;
}

// Generate random layout for each block
function generateRandomLayout(index: number, total: number, containerWidth: number): BlockLayout {
  const seed = index * 9301 + 49297; // Simple seeding for consistency
  const random = (n: number) => (Math.abs(Math.sin(seed + n)) * 10000) % 1;

  const scaleFactor = Math.min(containerWidth / 1200, 1);
  const baseSizes = [
    { w: 200, h: 200 },
    { w: 250, h: 180 },
    { w: 280, h: 240 },
    { w: 320, h: 280 },
    { w: 180, h: 220 },
    { w: 240, h: 200 },
  ];

  const sizes = baseSizes.map((size) => ({
    w: Math.round(size.w * scaleFactor),
    h: Math.round(size.h * scaleFactor),
  }));

  const size = sizes[Math.floor(random(1) * sizes.length)]!;

  const gridSpacing = Math.round(280 * scaleFactor);
  const rowHeight = Math.round(260 * scaleFactor);
  const cols = Math.floor(containerWidth / gridSpacing);
  const gridX = (index % cols) * gridSpacing;
  const gridY = Math.floor(index / cols) * rowHeight;

  const xOffset = random(2) * Math.round(40 * scaleFactor) - Math.round(20 * scaleFactor);
  const yOffset = random(3) * Math.round(30 * scaleFactor) - Math.round(15 * scaleFactor);

  const rotation = random(4) * 12 - 6;

  const zIndex = Math.floor(random(5) * 20) + 1;

  return {
    width: `${size.w}px`,
    height: `${size.h}px`,
    top: `${gridY + yOffset}px`,
    left: `${gridX + xOffset}px`,
    zIndex,
    rotation,
  };
}

export function CameraRoll(props: CameraRollProps) {
  const contents = createAsync(() => getChannelContents(props.slug, { per: 20 }));

  const layouts = createMemo(() => {
    const contentsData = contents();
    if (!contentsData?.data) return [];
    return contentsData.data.map((_, i) => generateRandomLayout(i, contentsData.data.length, 500));
  });

  const containerDimensions = createMemo(() => {
    const layoutsData = layouts();
    if (layoutsData.length === 0) return { width: 0, height: 0 };

    let maxWidth = 0;
    let maxHeight = 0;

    layoutsData.forEach((layout) => {
      const width = parseInt(layout.width);
      const height = parseInt(layout.height);
      const left = parseInt(layout.left);
      const top = parseInt(layout.top);

      maxWidth = Math.max(maxWidth, left + width);
      maxHeight = Math.max(maxHeight, top + height);
    });

    return { width: maxWidth, height: maxHeight };
  });

  return (
    <Show when={contents()} fallback={<Spinner />}>
      {(response) => (
        <Show
          when={response().data && response().data.length > 0}
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
          <div class="">
            <div
              class="relative mx-auto"
              style={{
                height: `${containerDimensions().height}px`,
                width: `${containerDimensions().width}px`,
                "min-height": "400px",
                "max-width": "100%",
              }}
            >
              <Index each={response().data}>
                {(item, index) => {
                  const layout = layouts()[index]!;
                  return (
                    <div
                      class="absolute transition-transform hover:scale-200 hover:z-9999"
                      style={{
                        width: layout.width,
                        height: layout.height,
                        top: layout.top,
                        left: layout.left,
                        "z-index": layout.zIndex,
                        transform: `rotate(${layout.rotation}deg)`,
                      }}
                    >
                      <div class="w-full h-full shadow-lg">
                        <ArenaItem item={item()} />
                      </div>
                    </div>
                  );
                }}
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
      )}
    </Show>
  );
}

function ArenaItem(props: { item: ArenaChannelContents }) {
  const item = () => props.item;

  return (
    <Show when={item().base_type === "Block"}>
      <ArenaBlockItem block={item() as ArenaBlock} />
    </Show>
  );
}

function ImageBlock(props: { block: ArenaBlock }) {
  const block = () => props.block;
  const [loaded, setLoaded] = createSignal(false);

  const blurhashDataUrl = createMemo(() => Effect.runSync(decodeBlurhash(block().image?.blurhash)));

  return (
    <div class="image-block relative w-full h-full bg-gray-100">
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
        alt={block().image?.alt_text || block().title || block().generated_title || ""}
        class="w-full h-full object-cover"
        classList={{ "opacity-0": !!blurhashDataUrl() && !loaded() }}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </div>
  );
}

function ArenaBlockItem(props: { block: ArenaBlock }) {
  const block = () => props.block;

  return (
    <div class="arena-block h-full overflow-hidden">
      <Show when={block().type === "Image"}>
        <ImageBlock block={block()} />
      </Show>
      <Show when={block().type === "Attachment"}>
        <AttachmentBlock block={block()} />
      </Show>
    </div>
  );
}

function AttachmentBlock(props: { block: ArenaBlock }) {
  const block = () => props.block;

  const fileName = () => block().attachment?.file_name || "";
  const fileUrl = () => block().attachment?.url || "";
  const isVideo = () => fileName().toLowerCase().endsWith(".mp4");

  return (
    <div class="attachment-block h-full">
      <Show when={isVideo()}>
        <div class="media-container relative w-full h-full bg-black">
          <video src={fileUrl()} controls class="w-full h-full object-contain">
            Your browser does not support the video element.
          </video>
        </div>
      </Show>
    </div>
  );
}

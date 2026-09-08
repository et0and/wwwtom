import { useInfiniteQuery, useQuery } from "@tanstack/solid-query";
import { Effect } from "effect";
import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { isServer } from "@solidjs/web";
import { Metadata } from "@tom/ui/Meta";
import { Dialog } from "@tom/ui/tomui/dialog";
import { Loader } from "@tom/ui/tomui/loader";
import type { ArenaBlock, ArenaChannelContents } from "@tom/schemas/arena";
import { fetchChannel, fetchChannelContentsPage } from "~/server/adapter";
import { computeCanvasLayout } from "~/libs/canvas/layout";
import { ArenaBlockItem } from "~/components/Arena";
import { CanvasTile, ChannelTile, describeCanvasItem } from "./CanvasTile";

const CANVAS_PAGE_SIZE = 100;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

const clampScale = (value: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export function CanvasChannel(props: { slug: string }) {
  const slug = () => props.slug;
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [scale, setScale] = createSignal(1);
  const [selected, setSelected] = createSignal<ArenaBlock | null>(null);
  const camera = { x: 0, y: 0, scale: 1, centered: false };
  const drag = {
    active: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
  };
  const sentinel = { el: null as HTMLDivElement | null };
  let viewport: HTMLDivElement | undefined;

  const channelQuery = useQuery(() => ({
    queryKey: ["canvas-channel", slug()],
    queryFn: () => fetchChannel(slug()),
    enabled: slug().length > 0,
    deferStream: true,
  }));

  const contentsQuery = useInfiniteQuery(() => ({
    queryKey: ["canvas-contents", slug()],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      fetchChannelContentsPage(slug(), pageParam, CANVAS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.has_more_pages) return undefined;
      return lastPage.meta.next_page ?? lastPage.meta.current_page + 1;
    },
    enabled: slug().length > 0,
  }));

  const blocks = createMemo(
    (): ReadonlyArray<ArenaChannelContents> =>
      contentsQuery.data?.pages.flatMap((page) => page.data) ?? [],
  );

  const blockById = createMemo(() => new Map(blocks().map((block) => [String(block.id), block])));

  const positioned = createMemo(() => {
    const current = Effect.runSync(
      computeCanvasLayout({ slug: slug(), items: blocks().map(describeCanvasItem) }),
    );
    return {
      bounds: current.bounds,
      tiles: current.tiles.map((tile) => ({
        ...tile,
        x: tile.x - current.bounds.minX,
        y: tile.y - current.bounds.minY,
      })),
    };
  });

  const totalCount = createMemo(
    () => contentsQuery.data?.pages[0]?.meta.total_count ?? blocks().length,
  );

  const pageTitle = createMemo(() => channelQuery.data?.title || slug());
  const pageDescription = createMemo(
    () => channelQuery.data?.description?.markdown?.slice(0, 160) ?? "",
  );

  const transform = createMemo(() => `translate(${x()}px, ${y()}px) scale(${scale()})`);

  const syncCamera = (): void => {
    setX(camera.x);
    setY(camera.y);
    setScale(camera.scale);
  };

  const centerCamera = (): void => {
    if (!viewport || isServer) return;
    const rect = viewport.getBoundingClientRect();
    camera.x = rect.width / 2 - positioned().bounds.width / 2;
    camera.y = rect.height / 2 - positioned().bounds.height / 2;
    camera.scale = 1;
    syncCamera();
  };

  const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    if (!viewport) return;
    const next = clampScale(camera.scale * factor);
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    camera.x = px - ((px - camera.x) / camera.scale) * next;
    camera.y = py - ((py - camera.y) / camera.scale) * next;
    camera.scale = next;
    syncCamera();
  };

  const zoomCenter = (factor: number): void => {
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  const openBlock = (block: ArenaBlock): void => {
    if (drag.moved) return;
    setSelected(block);
  };

  const onPointerDown = (event: PointerEvent): void => {
    drag.active = true;
    drag.moved = false;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.x = camera.x;
    drag.y = camera.y;
    viewport?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drag.active) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (distance > 4) drag.moved = true;
    drag.x += event.clientX - drag.lastX;
    drag.y += event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    camera.x = drag.x;
    camera.y = drag.y;
    syncCamera();
  };

  const endPointer = (): void => {
    drag.active = false;
  };

  const observeSentinel = (element: HTMLDivElement): void => {
    sentinel.el = element;
  };

  createEffect(
    () => positioned().bounds.width,
    (width) => {
      if (width === 0 || camera.centered || !viewport || isServer) return;
      if (blocks().length === 0) return;
      centerCamera();
      camera.centered = true;
    },
  );

  createEffect(
    () => contentsQuery.error,
    (error) => {
      if (error) {
        void Effect.runFork(Effect.logWarning(`[canvas] contents failed for "${slug()}"`));
      }
    },
  );

  createEffect(
    () => ({
      pages: contentsQuery.data?.pages.length ?? 0,
      more: contentsQuery.hasNextPage,
    }),
    () => {
      const element = sentinel.el;
      if (!element || isServer || !("IntersectionObserver" in globalThis)) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) void contentsQuery.fetchNextPage();
        },
        { rootMargin: "1200px" },
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
  );

  onSettled(() => {
    if (isServer || !viewport) return;
    const element = viewport;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0015));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    const onKey = (event: KeyboardEvent): void => {
      if (selected() !== null) {
        if (event.key === "Escape") setSelected(null);
        return;
      }
      const step = 60 / camera.scale;
      if (event.key === "ArrowLeft") {
        camera.x += step;
        syncCamera();
        return;
      }
      if (event.key === "ArrowRight") {
        camera.x -= step;
        syncCamera();
        return;
      }
      if (event.key === "ArrowUp") {
        camera.y += step;
        syncCamera();
        return;
      }
      if (event.key === "ArrowDown") {
        camera.y -= step;
        syncCamera();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        zoomCenter(1.2);
        return;
      }
      if (event.key === "-") {
        zoomCenter(1 / 1.2);
        return;
      }
      if (event.key === "0") {
        centerCamera();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  });

  return (
    <div class="relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-950">
      <Metadata
        title={`Canvas ${pageTitle()}`}
        metaType="description"
        metaContent={pageDescription() || `Are.na channel ${slug()} as an open canvas.`}
        canonical={`https://tom.so/canvas/${slug()}`}
      />
      <header class="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-black/10 bg-white/90 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-neutral-900/90">
        <a href="/" class="text-sm underline" aria-label="Back home">
          Home
        </a>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-sm font-medium">{pageTitle()}</h1>
          <p class="text-[11px] opacity-60">
            {blocks().length} of {totalCount()} blocks
          </p>
        </div>
        <div class="flex items-center gap-1" role="toolbar" aria-label="Canvas controls">
          <button
            type="button"
            class="rounded border border-black/10 px-2 py-1 text-sm"
            aria-label="Zoom out"
            onClick={() => zoomCenter(1 / 1.2)}
          >
            -
          </button>
          <button
            type="button"
            class="rounded border border-black/10 px-2 py-1 text-sm"
            aria-label="Zoom in"
            onClick={() => zoomCenter(1.2)}
          >
            +
          </button>
          <button
            type="button"
            class="rounded border border-black/10 px-2 py-1 text-sm"
            onClick={centerCamera}
          >
            Reset
          </button>
        </div>
        <a
          href={`https://are.na/tom/${slug()}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs underline"
        >
          Source
        </a>
      </header>
      <Show
        when={!contentsQuery.isLoading}
        fallback={
          <div class="absolute inset-0 top-14 flex items-center justify-center">
            <Loader />
          </div>
        }
      >
        <Show
          when={!contentsQuery.error}
          fallback={
            <div class="absolute inset-0 top-14 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p class="text-sm">This channel cannot load.</p>
              <button
                type="button"
                class="rounded border border-black/10 px-3 py-1 text-sm underline"
                onClick={() => void contentsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          }
        >
          <Show
            when={blocks().length > 0}
            fallback={
              <div class="absolute inset-0 top-14 flex items-center justify-center p-6 text-center">
                <p class="text-sm">This channel holds no blocks.</p>
              </div>
            }
          >
            <div
              ref={(element) => {
                viewport = element;
              }}
              class="absolute inset-x-0 bottom-0 top-14 touch-none select-none overflow-hidden"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            >
              <div
                class="absolute left-0 top-0 will-change-transform"
                style={{
                  width: `${positioned().bounds.width}px`,
                  height: `${positioned().bounds.height}px`,
                  transform: transform(),
                }}
              >
                <For each={positioned().tiles}>
                  {(tile) => {
                    const found = blockById().get(tile.id);
                    if (!found) return null;
                    if (!("base_type" in found)) {
                      return <ChannelTile slug={found.slug} title={found.title} layout={tile} />;
                    }
                    return <CanvasTile item={found} layout={tile} onOpen={openBlock} />;
                  }}
                </For>
                <div
                  ref={observeSentinel}
                  class="absolute h-1 w-1"
                  style={{
                    left: `${positioned().bounds.width / 2}px`,
                    top: `${positioned().bounds.height - 4}px`,
                  }}
                />
              </div>
            </div>
            <div class="absolute inset-x-0 bottom-0 z-20 flex justify-center pb-3">
              <Show when={contentsQuery.hasNextPage}>
                <button
                  type="button"
                  class="rounded-full border border-black/10 bg-white/90 px-4 py-1 text-xs shadow backdrop-blur dark:bg-neutral-900/90"
                  onClick={() => void contentsQuery.fetchNextPage()}
                >
                  <Show
                    when={contentsQuery.isFetchingNextPage}
                    fallback={`Load more (${blocks().length} of ${totalCount()})`}
                  >
                    Loading more
                  </Show>
                </button>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>
      <Dialog.Root
        open={selected() !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog size="xl" class="max-h-[85vh] overflow-auto p-6">
          <Show when={selected()}>
            {(block) => (
              <>
                <Dialog.Title class="pr-8 text-lg font-semibold">
                  {block().title || `${block().type} block`}
                </Dialog.Title>
                <div class="mt-4">
                  <ArenaBlockItem block={block()} />
                </div>
                <div class="mt-4 flex justify-end">
                  <Dialog.Close class="rounded border border-black/10 px-3 py-1 text-sm">
                    Close
                  </Dialog.Close>
                </div>
              </>
            )}
          </Show>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}

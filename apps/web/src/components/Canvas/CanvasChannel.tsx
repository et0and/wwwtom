import { useInfiniteQuery, useQuery } from "@tanstack/solid-query";
import { Effect } from "effect";
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { isServer } from "@solidjs/web";
import { Metadata } from "@tom/ui/Meta";
import { Button, buttonVariants } from "@tom/ui/tomui/button";
import { Dialog } from "@tom/ui/tomui/dialog";
import { Loader } from "@tom/ui/tomui/loader";
import type { ArenaBlock, ArenaChannelContents } from "@tom/schemas/arena";
import { fetchChannel, fetchChannelContentsPage } from "~/server/adapter";
import { computeCanvasLayout, tileIntersectsView } from "~/libs/canvas/layout";
import type { WorldView } from "~/libs/canvas/layout";
import { ArenaBlockItem } from "~/components/Arena";
import { CanvasTile, ChannelTile, CulledTile, describeCanvasItem } from "./CanvasTile";

const CANVAS_PAGE_SIZE = 100;
const MAX_SCALE = 2.5;
const DETAIL_SCALE = 0.55;
const MIN_SCALE_FLOOR = 0.12;
// Premium tier allows 300 requests per minute; backoff covers lower tiers.
const PAGE_FETCH_GAP_MS = 800;
const PAGE_RETRY_COUNT = 5;
const PAGE_RETRY_MAX_DELAY_MS = 10000;
const CANVAS_STALE_MS = 10 * 60 * 1000;
const CANVAS_GC_MS = 60 * 60 * 1000;

interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

interface PointerPoint {
  readonly x: number;
  readonly y: number;
}

export function CanvasChannel(props: { slug: string }) {
  const slug = () => props.slug;
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [scale, setScale] = createSignal(1);
  const [selected, setSelected] = createSignal<ArenaBlock | null>(null);
  const [sentinelVisible, setSentinelVisible] = createSignal(false);
  const [viewportSize, setViewportSize] = createSignal<ViewportSize>({ width: 0, height: 0 });
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
  const pointers = new Map<number, PointerPoint>();
  const pinch = { active: false, distance: 0, midX: 0, midY: 0 };
  const sentinel = { el: null as HTMLDivElement | null };
  const pager = {
    lastFetch: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    inView: false,
  };
  const [viewportEl, setViewportEl] = createSignal<HTMLDivElement | null>(null);

  const channelQuery = useQuery(() => ({
    queryKey: ["canvas-channel", slug()],
    queryFn: () => fetchChannel(slug()),
    enabled: slug().length > 0,
    deferStream: true,
    staleTime: CANVAS_STALE_MS,
    gcTime: CANVAS_GC_MS,
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
    retry: PAGE_RETRY_COUNT,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, PAGE_RETRY_MAX_DELAY_MS),
    staleTime: CANVAS_STALE_MS,
    gcTime: CANVAS_GC_MS,
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
  const pageTitle = createMemo(() => channelQuery.data?.title || slug());
  const pageDescription = createMemo(
    () => channelQuery.data?.description?.markdown?.slice(0, 160) ?? "",
  );

  const transform = createMemo(() => `translate(${x()}px, ${y()}px) scale(${scale()})`);

  const minZoom = createMemo(() => {
    const bounds = positioned().bounds;
    const size = viewportSize();
    if (bounds.width === 0 || size.width === 0) return MIN_SCALE_FLOOR;
    const fit = Math.min(size.width / bounds.width, size.height / bounds.height);
    return Math.max(MIN_SCALE_FLOOR, Math.min(fit, 0.5));
  });

  const clampZoom = (value: number): number => Math.min(MAX_SCALE, Math.max(minZoom(), value));

  const detailVisible = createMemo(() => scale() >= DETAIL_SCALE);

  const visibleWorld = createMemo((): WorldView => {
    const zoom = scale();
    const size = viewportSize();
    if (size.width === 0 && size.height === 0) {
      return { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
    }
    const margin = Math.max(size.width, size.height) / Math.max(zoom, MIN_SCALE_FLOOR);
    return {
      minX: -x() / zoom - margin,
      minY: -y() / zoom - margin,
      maxX: (-x() + size.width) / zoom + margin,
      maxY: (-y() + size.height) / zoom + margin,
    };
  });

  const syncCamera = (): void => {
    setX(camera.x);
    setY(camera.y);
    setScale(camera.scale);
  };

  const centerCamera = (): void => {
    const element = viewportEl();
    if (!element || isServer) return;
    const rect = element.getBoundingClientRect();
    camera.x = rect.width / 2 - positioned().bounds.width / 2;
    camera.y = rect.height / 2 - positioned().bounds.height / 2;
    camera.scale = 1;
    syncCamera();
  };

  const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    const element = viewportEl();
    if (!element) return;
    const next = clampZoom(camera.scale * factor);
    const rect = element.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    camera.x = px - ((px - camera.x) / camera.scale) * next;
    camera.y = py - ((py - camera.y) / camera.scale) * next;
    camera.scale = next;
    syncCamera();
  };

  const zoomCenter = (factor: number): void => {
    const element = viewportEl();
    if (!element) return;
    const rect = element.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  const openBlock = (block: ArenaBlock): void => {
    if (drag.moved) return;
    setSelected(block);
  };

  const pointerMidpoint = (): PointerPoint => {
    const points = [...pointers.values()];
    const first = points[0] ?? { x: 0, y: 0 };
    const second = points[1] ?? first;
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  };

  const pointerDistance = (): number => {
    const points = [...pointers.values()];
    const first = points[0] ?? { x: 0, y: 0 };
    const second = points[1] ?? first;
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  const onPointerDown = (event: PointerEvent): void => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === "mouse") viewportEl()?.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      drag.active = false;
      pinch.active = true;
      drag.moved = true;
      pinch.distance = pointerDistance();
      const mid = pointerMidpoint();
      pinch.midX = mid.x;
      pinch.midY = mid.y;
      return;
    }
    if (pointers.size > 2) return;
    drag.active = true;
    drag.moved = false;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.x = camera.x;
    drag.y = camera.y;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    const moves = event.getCoalescedEvents?.() ?? [];
    const move = moves[moves.length - 1] ?? event;
    pointers.set(event.pointerId, { x: move.clientX, y: move.clientY });
    if (pinch.active && pointers.size >= 2) {
      const distance = pointerDistance();
      const mid = pointerMidpoint();
      if (pinch.distance > 0) zoomAt(mid.x, mid.y, distance / pinch.distance);
      camera.x += mid.x - pinch.midX;
      camera.y += mid.y - pinch.midY;
      syncCamera();
      pinch.distance = distance;
      pinch.midX = mid.x;
      pinch.midY = mid.y;
      return;
    }
    if (!drag.active) return;
    const distance = Math.hypot(move.clientX - drag.startX, move.clientY - drag.startY);
    if (distance > 4) drag.moved = true;
    drag.x += move.clientX - drag.lastX;
    drag.y += move.clientY - drag.lastY;
    drag.lastX = move.clientX;
    drag.lastY = move.clientY;
    camera.x = drag.x;
    camera.y = drag.y;
    syncCamera();
  };

  const endPointer = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch.active = false;
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0] ?? { x: 0, y: 0 };
      drag.active = true;
      drag.lastX = remaining.x;
      drag.lastY = remaining.y;
      drag.startX = remaining.x;
      drag.startY = remaining.y;
      drag.x = camera.x;
      drag.y = camera.y;
      return;
    }
    if (pointers.size === 0) drag.active = false;
  };

  const observeSentinel = (element: HTMLDivElement): void => {
    sentinel.el = element;
  };

  createEffect(
    () => positioned().bounds.width,
    (width) => {
      if (width === 0 || camera.centered || !viewportEl() || isServer) return;
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
          pager.inView = entries[0]?.isIntersecting === true;
          setSentinelVisible(pager.inView && document.visibilityState === "visible");
        },
        { rootMargin: "1200px" },
      );
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    },
  );

  createEffect(
    () => ({
      visible: sentinelVisible(),
      pages: contentsQuery.data?.pages.length ?? 0,
      more: contentsQuery.hasNextPage,
      fetching: contentsQuery.isFetching,
    }),
    (state) => {
      onCleanup(() => {
        if (pager.timer) clearTimeout(pager.timer);
        pager.timer = null;
      });
      if (!state.visible || !state.more || state.fetching) return;
      const wait = Math.max(0, PAGE_FETCH_GAP_MS - (Date.now() - pager.lastFetch));
      pager.timer = setTimeout(() => {
        pager.lastFetch = Date.now();
        if (document.visibilityState === "visible") void contentsQuery.fetchNextPage();
      }, wait);
    },
  );

  createEffect(
    () => viewportEl(),
    (element) => {
      if (isServer || !element) return;
      const onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0015));
      };
      element.addEventListener("wheel", onWheel, { passive: false });
      const measure = (): void => {
        setViewportSize({ width: element.clientWidth, height: element.clientHeight });
      };
      measure();
      window.addEventListener("resize", measure);
      const stopGesture = (event: Event): void => {
        event.preventDefault();
      };
      document.addEventListener("gesturestart", stopGesture);
      document.addEventListener("gesturechange", stopGesture);
      const onVisibility = (): void => {
        setSentinelVisible(pager.inView && document.visibilityState === "visible");
      };
      document.addEventListener("visibilitychange", onVisibility);
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
      onCleanup(() => {
        element.removeEventListener("wheel", onWheel);
        document.removeEventListener("gesturestart", stopGesture);
        document.removeEventListener("gesturechange", stopGesture);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", measure);
        window.removeEventListener("keydown", onKey);
      });
    },
  );

  return (
    <div class="relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-950">
      <Metadata
        title={`Canvas ${pageTitle()}`}
        metaType="description"
        metaContent={pageDescription() || `Are.na channel ${slug()} as an open canvas.`}
        canonical={`https://tom.so/canvas/${slug()}`}
      />
      <Show
        when={!contentsQuery.isLoading}
        fallback={
          <div class="absolute inset-0 flex items-center justify-center">
            <Loader />
          </div>
        }
      >
        <Show
          when={blocks().length === 0 && contentsQuery.error !== null}
          fallback={
            <Show
              when={blocks().length > 0}
              fallback={
                <div class="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <p class="text-sm">This channel holds no blocks.</p>
                </div>
              }
            >
              <div
                ref={(element) => {
                  setViewportEl(element);
                }}
                class="absolute inset-0 touch-none overflow-hidden bg-[radial-gradient(circle,rgb(0_0_0/0.14)_1px,transparent_1px)] bg-[size:28px_28px] select-none dark:bg-[radial-gradient(circle,rgb(255_255_255/0.14)_1px,transparent_1px)]"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                onContextMenu={(event) => event.preventDefault()}
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
                      const inView = tileIntersectsView(tile, visibleWorld());
                      if (!("base_type" in found)) {
                        return (
                          <CulledTile layout={tile} visible={inView}>
                            <ChannelTile slug={found.slug} title={found.title} layout={tile} />
                          </CulledTile>
                        );
                      }
                      return (
                        <CulledTile layout={tile} visible={inView}>
                          <CanvasTile
                            item={found}
                            layout={tile}
                            detail={detailVisible()}
                            onOpen={openBlock}
                          />
                        </CulledTile>
                      );
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
            </Show>
          }
        >
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p class="text-sm">This channel cannot load.</p>
            <Button variant="secondary" onClick={() => void contentsQuery.refetch()}>
              Retry
            </Button>
          </div>
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
                  <Dialog.Close class={buttonVariants({ variant: "secondary" })}>
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

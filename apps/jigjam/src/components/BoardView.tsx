import { For, Show, createMemo, createSignal, onSettled, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "@tom/ui/tomui/button";
import { LayerCard } from "@tom/ui/tomui/layer-card";
import { Text } from "@tom/ui/tomui/text";
import { Meter } from "@tom/ui/tomui/meter";
import { Banner } from "@tom/ui/tomui/banner";
import { Loader } from "@tom/ui/tomui/loader";
import { formatElapsed } from "../lib/format";
import { piecePath } from "../lib/edges";
import type { EdgeSet } from "../lib/edges";
import { correctXY, findSnap, groupMembers, isSolved, layoutFor, progressOf } from "../lib/board";
import type { BoardLayout } from "../lib/board";
import type { PersistedPiece } from "../lib/storage";
import { snapThreshold } from "../lib/storage";
import { PieceView } from "./PieceView";

export type BoardPuzzle = {
  readonly imageSrc: string;
  readonly label: string;
  readonly rows: number;
  readonly cols: number;
  readonly boardW: number;
  readonly boardH: number;
  readonly edges: EdgeSet;
};

export const BoardView = (props: {
  readonly puzzle: BoardPuzzle;
  readonly initialPositions: ReadonlyArray<PersistedPiece>;
  readonly initialElapsed: number;
  readonly initialMoves: number;
  readonly onPersist: (
    positions: ReadonlyArray<PersistedPiece>,
    elapsed: number,
    moves: number,
    complete: boolean,
  ) => void;
  readonly onExit: () => void;
  readonly onReplay: () => void;
}): JSX.Element => {
  const layout = (): BoardLayout =>
    layoutFor(props.puzzle.boardW, props.puzzle.boardH, props.puzzle.cols, props.puzzle.rows);
  const [pieces, setPieces] = createSignal<ReadonlyArray<PersistedPiece>>(
    untrack(() => [...props.initialPositions]),
  );
  const [elapsed, setElapsed] = createSignal(untrack(() => props.initialElapsed));
  const [moves, setMoves] = createSignal(untrack(() => props.initialMoves));
  const [front, setFront] = createSignal<Record<number, number>>({});
  const [zTop, setZTop] = createSignal(100);
  const [showGhost, setShowGhost] = createSignal(true);
  const [imageReady, setImageReady] = createSignal(false);

  const progress = createMemo(() => progressOf(pieces(), props.puzzle.rows, props.puzzle.cols));
  const complete = createMemo(() => isSolved(pieces(), props.puzzle.rows, props.puzzle.cols));
  const pathFor = (id: number): string => {
    const count = props.puzzle.cols;
    return piecePath(
      layout().cellW,
      layout().cellH,
      layout().pad,
      props.puzzle.edges,
      Math.floor(id / count),
      id % count,
    );
  };
  const zFor = (id: number): number => front()[id] ?? 1;

  const persistNow = (): void => {
    props.onPersist([...pieces()], elapsed(), moves(), complete());
  };

  onSettled(() => {
    const timer = setInterval(() => {
      if (!complete()) {
        setElapsed((value) => value + 1);
        if ((elapsed() + 1) % 10 === 0) persistNow();
      }
    }, 1000);
    const preload = new Image();
    preload.onload = () => setImageReady(true);
    preload.onerror = () => setImageReady(true);
    preload.src = props.puzzle.imageSrc;
    return () => clearInterval(timer);
  });

  const drag = {
    active: false,
    members: [] as Array<number>,
    startX: 0,
    startY: 0,
    current: new Map<number, { x: number; y: number }>(),
    origins: new Map<number, { x: number; y: number }>(),
  };

  const writeDragged = (): void => {
    const current = new Map(drag.current);
    setPieces((previous) =>
      previous.map((piece: PersistedPiece, id: number) => {
        const moved = current.get(id);
        return moved ? { ...piece, x: moved.x, y: moved.y } : piece;
      }),
    );
  };

  const onPieceDown = (id: number, event: PointerEvent): void => {
    if (complete()) return;
    event.preventDefault();
    const target = event.currentTarget;
    if (target instanceof Element) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic or already-released pointers have nothing to capture;
        // the drag still tracks through the element handlers.
      }
    }
    const group = pieces()[id]?.group ?? id;
    drag.active = true;
    drag.members = groupMembers(pieces(), group);
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.current.clear();
    drag.origins.clear();
    for (const member of drag.members) {
      const at = pieces()[member];
      if (!at) continue;
      drag.origins.set(member, { x: at.x, y: at.y });
      drag.current.set(member, { x: at.x, y: at.y });
    }
    const top = zTop() + 1;
    setZTop(top);
    const order: Record<number, number> = {};
    for (const member of drag.members) order[member] = top;
    setFront((previous) => ({ ...previous, ...order }));
  };

  const onPieceMove = (id: number, event: PointerEvent): void => {
    if (!drag.active || !drag.members.includes(id)) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    for (const member of drag.members) {
      const origin = drag.origins.get(member);
      if (!origin) continue;
      drag.current.set(member, { x: origin.x + dx, y: origin.y + dy });
    }
    writeDragged();
  };

  const onPieceUp = (id: number, event: PointerEvent): void => {
    if (!drag.active || !drag.members.includes(id)) return;
    event.preventDefault();
    drag.active = false;
    // Rebuild from the committed board plus the in-flight drag offsets, so
    // the snap check and the save below never see a half-flushed board.
    const snapshot = pieces().map((piece: PersistedPiece, index: number) => {
      const moved = drag.current.get(index);
      return moved ? { ...piece, x: moved.x, y: moved.y } : piece;
    });
    const snap = findSnap(
      snapshot,
      drag.members,
      props.puzzle.rows,
      props.puzzle.cols,
      layout().cellW,
      layout().cellH,
      snapThreshold(),
    );
    const joined = snap !== null;
    const applySnap = (
      list: ReadonlyArray<PersistedPiece>,
      correction: { readonly dx: number; readonly dy: number; readonly with: number },
    ): Array<PersistedPiece> => {
      const targetGroup = list[correction.with]?.group;
      return list.map((piece: PersistedPiece, index: number) => {
        if (!drag.members.includes(index)) return piece;
        return {
          ...piece,
          x: piece.x + correction.dx,
          y: piece.y + correction.dy,
          group: targetGroup ?? piece.group,
        };
      });
    };
    const final: Array<PersistedPiece> = snap ? applySnap(snapshot, snap) : snapshot;
    const nextMoves = moves() + (joined ? 1 : 0);
    const done = isSolved(final, props.puzzle.rows, props.puzzle.cols);
    setPieces(final);
    if (joined) setMoves(nextMoves);
    drag.members = [];
    drag.current.clear();
    drag.origins.clear();
    props.onPersist([...final], elapsed(), nextMoves, done);
  };

  const ids = createMemo(() => pieces().map((piece: PersistedPiece, id: number) => id));

  return (
    <div class="jigjam-board">
      <LayerCard class="px-5 py-4">
        <div class="jigjam-topbar">
          <div>
            <Text variant="heading" as="h1">
              {props.puzzle.label}
            </Text>
            <Text variant="secondary" size="sm">
              {props.puzzle.rows} × {props.puzzle.cols} · {moves()} moves ·{" "}
              <span class="jigjam-time">{formatElapsed(elapsed())}</span>
            </Text>
          </div>
          <div class="jigjam-actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowGhost((value) => !value)}
              aria-pressed={showGhost() ? "true" : "false"}
            >
              {showGhost() ? "Hide guide" : "Show guide"}
            </Button>
            <Button size="sm" variant="secondary" onClick={props.onReplay}>
              Shuffle
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onExit}>
              New puzzle
            </Button>
          </div>
        </div>
        <Meter
          label="Joined"
          value={Math.round(progress() * 100)}
          customValue={complete() ? "Done" : `${Math.round(progress() * 100)}%`}
        />
      </LayerCard>

      <Show when={complete()}>
        <Banner
          title="Solved"
          description={`Finished in ${formatElapsed(elapsed())} with ${moves()} joins. Nicely unhurried.`}
          action={
            <span class="flex gap-2">
              <Banner.Action onClick={props.onReplay}>Play again</Banner.Action>
              <Banner.Action variant="secondary" onClick={props.onExit}>
                New puzzle
              </Banner.Action>
            </span>
          }
        />
      </Show>

      <div class="jigjam-scroll">
        <div
          class="jigjam-play"
          style={{
            width: `${layout().playW}px`,
            height: `${layout().playH}px`,
          }}
        >
          <Show when={showGhost()}>
            <img
              src={props.puzzle.imageSrc}
              alt=""
              aria-hidden="true"
              draggable="false"
              class="jigjam-ghost"
              style={{
                left: `${layout().originX}px`,
                top: `${layout().originY}px`,
                width: `${props.puzzle.boardW}px`,
                height: `${props.puzzle.boardH}px`,
              }}
            />
          </Show>
          <Show when={!imageReady()} fallback={null}>
            <p class="jigjam-loading">
              <Loader size="sm" /> Preparing pieces…
            </p>
          </Show>
          <For each={ids()}>
            {(id) => {
              const piece = (): PersistedPiece =>
                pieces()[id] ?? { ...correctXY(layout(), id, props.puzzle.cols), group: id };
              const count = (): number => props.puzzle.cols;
              const row = (): number => Math.floor(id / count());
              const col = (): number => id % count();
              return (
                <PieceView
                  id={id}
                  x={piece().x}
                  y={piece().y}
                  width={layout().cellW + layout().pad * 2}
                  height={layout().cellH + layout().pad * 2}
                  path={pathFor(id)}
                  imageHref={props.puzzle.imageSrc}
                  imageX={layout().pad - col() * layout().cellW}
                  imageY={layout().pad - row() * layout().cellH}
                  imageW={props.puzzle.boardW}
                  imageH={props.puzzle.boardH}
                  z={zFor(id)}
                  locked={complete()}
                  onPointerDown={onPieceDown}
                  onPointerMove={onPieceMove}
                  onPointerUp={onPieceUp}
                />
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};

import type { JSX } from "@solidjs/web";

export type PieceViewProps = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly path: string;
  readonly imageHref: string;
  readonly imageX: number;
  readonly imageY: number;
  readonly imageW: number;
  readonly imageH: number;
  readonly z: number;
  readonly locked: boolean;
  readonly onPointerDown: (id: number, event: PointerEvent) => void;
  readonly onPointerMove: (id: number, event: PointerEvent) => void;
  readonly onPointerUp: (id: number, event: PointerEvent) => void;
};

export const PieceView = (props: PieceViewProps): JSX.Element => {
  const clipId = (): string => `jigjam-clip-${props.id}`;
  return (
    <div
      data-piece={props.id}
      onPointerDown={(event) => props.onPointerDown(props.id, event)}
      onPointerMove={(event) => props.onPointerMove(props.id, event)}
      onPointerUp={(event) => props.onPointerUp(props.id, event)}
      onPointerCancel={(event) => props.onPointerUp(props.id, event)}
      style={{
        position: "absolute",
        left: `${props.x}px`,
        top: `${props.y}px`,
        width: `${props.width}px`,
        height: `${props.height}px`,
        "z-index": `${props.z}`,
        cursor: "grab",
        "touch-action": "none",
        filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))",
        opacity: props.locked ? "1" : "0.98",
      }}
    >
      <svg width={props.width} height={props.height} aria-hidden="true">
        <defs>
          <clipPath id={clipId()}>
            <path d={props.path} />
          </clipPath>
        </defs>
        <g clip-path={`url(#${clipId()})`}>
          <image
            href={props.imageHref}
            x={props.imageX}
            y={props.imageY}
            width={props.imageW}
            height={props.imageH}
            preserveAspectRatio="none"
          />
        </g>
        <path
          d={props.path}
          fill="none"
          stroke="rgb(60 55 50 / 0.35)"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  );
};

import { For } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@tom/ui/colors.stylex";

const styles = stylex.create({
  svg: { display: "block", width: "100%", height: "100%" },
});

export interface GardenMatrixProps {
  rows: number;
  cols: number;
  /** Per-column levels in [0, 1], read reactively. */
  levels: () => readonly number[];
  size?: number;
  gap?: number;
  ariaLabel?: string;
}

interface Cell {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly column: number;
  readonly row: number;
}

/**
 * A dot-matrix level meter, in the style of the ElevenLabs UI Matrix: circular
 * cells on an SVG grid, each column filled from the bottom by its level. Lit
 * cells use `currentColor`, so the caller sets the colour.
 */
export function GardenMatrix(props: GardenMatrixProps) {
  const size = (): number => props.size ?? 10;
  const gap = (): number => props.gap ?? 2;
  const step = (): number => size() + gap();
  const width = (): number => props.cols * size() + (props.cols - 1) * gap();
  const height = (): number => props.rows * size() + (props.rows - 1) * gap();
  const radius = (): number => size() * 0.4;

  const cells = (): Cell[] => {
    const result: Cell[] = [];
    for (let row = 0; row < props.rows; row++) {
      for (let col = 0; col < props.cols; col++) {
        result.push({
          key: `${row}-${col}`,
          cx: col * step() + size() / 2,
          cy: row * step() + size() / 2,
          column: col,
          row,
        });
      }
    }
    return result;
  };

  const brightness = (column: number, row: number): number => {
    const level = props.levels()[column] ?? 0;
    const filled = level * props.rows;
    return Math.max(0, Math.min(1, filled - (props.rows - row - 1)));
  };

  return (
    <svg
      {...stylex.attrs(styles.svg)}
      viewBox={`0 0 ${width()} ${height()}`}
      role="img"
      aria-label={props.ariaLabel ?? "Audio level meter"}
      preserveAspectRatio="xMidYMid meet"
    >
      <For each={cells()}>
        {(cell) => {
          const value = (): number => brightness(cell.column, cell.row);
          return (
            <circle
              cx={cell.cx}
              cy={cell.cy}
              r={radius()}
              fill={value() > 0.01 ? "currentColor" : colors["--color-tomui-tint"]}
              opacity={value() > 0.01 ? value() : 1}
            />
          );
        }}
      </For>
    </svg>
  );
}

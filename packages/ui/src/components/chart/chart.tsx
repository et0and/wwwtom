import * as stylex from "@stylexjs/stylex";
import { For, merge, omit, onCleanup, onSettled, Show } from "solid-js";
import type { JSX } from "@solidjs/web";

const styles = stylex.create({
  root: { width: "100%" },
  sizeSm: { height: "4rem" },
  sizeBase: { height: "10rem" },
  sizeLg: { height: "16rem" },
  svg: { height: "100%", width: "100%" },
  host: { display: "contents" },
});

export const TOMUI_CHART_DEFAULT_VARIANTS = {
  type: "line",
  size: "base",
} as const;

export type TomuiChartType = "line" | "bar" | "sparkline" | "timeseries";
export type TomuiChartSize = "sm" | "base" | "lg";

export interface ChartDatum {
  label: string;
  value: number;
}

export type ChartProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element;
  data?: Array<ChartDatum>;
  height?: number;
  renderChart?: (el: HTMLDivElement) => void;
  size?: TomuiChartSize;
  type?: TomuiChartType;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

const sizeStyles = {
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiChartSize, stylex.StyleXStyles>;

export function chartVariants(
  props: { type?: TomuiChartType; size?: TomuiChartSize } = {},
): Array<stylex.StyleXStyles> {
  const merged = merge(TOMUI_CHART_DEFAULT_VARIANTS, props);
  return [styles.root, sizeStyles[merged.size]];
}

function toPoints(data: Array<ChartDatum>, width: number, height: number): string {
  const values = data.map((datum) => datum.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  return data
    .map((datum, index) => {
      const x = step * index;
      const y = height - ((datum.value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

interface ChartHostRef {
  current?: HTMLDivElement | undefined;
}

function Sparkline(props: { data: Array<ChartDatum>; type: TomuiChartType }): JSX.Element {
  const width = 300;
  const height = 80;
  const points = () => toPoints(props.data, width, height);
  return (
    <Show
      when={props.type === "bar"}
      fallback={
        <svg viewBox={`0 0 ${width} ${height}`} {...stylex.attrs(styles.svg)} aria-hidden="true">
          <polyline points={points()} fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
      }
    >
      <svg viewBox={`0 0 ${width} ${height}`} {...stylex.attrs(styles.svg)} aria-hidden="true">
        <For each={props.data}>
          {(datum: ChartDatum, index: () => number) => {
            const values = props.data.map((entry: ChartDatum) => entry.value);
            const max = Math.max(...values, 1);
            const barHeight = max === 0 ? 0 : (datum.value / max) * height;
            const barWidth = width / props.data.length;
            return (
              <rect
                x={barWidth * index() + 1}
                y={height - barHeight}
                width={Math.max(barWidth - 2, 1)}
                height={Math.max(barHeight, 0)}
                fill="currentColor"
              />
            );
          }}
        </For>
      </svg>
    </Show>
  );
}

export function Chart(props: ChartProps) {
  const merged = merge(
    { size: TOMUI_CHART_DEFAULT_VARIANTS.size, type: TOMUI_CHART_DEFAULT_VARIANTS.type },
    props,
  );
  const rest = omit(merged, "children", "style", "data", "height", "renderChart", "size", "type");
  const points = () => toPoints(merged.data ?? [], 600, 200);
  const inlineStyle = (): JSX.CSSProperties | undefined =>
    merged.height === undefined ? undefined : { height: `${merged.height}px` };
  const hostRef: ChartHostRef = { current: undefined };
  onSettled(() => {
    const el = hostRef.current;
    if (el && merged.renderChart) merged.renderChart(el);
  });
  onCleanup(() => {
    hostRef.current = undefined;
  });
  return (
    <div
      data-tomui-component="Chart"
      {...stylex.attrs(...chartVariants({ size: merged.size, type: merged.type }), merged.style)}
      style={inlineStyle()}
      {...rest}
    >
      <Show when={merged.data && merged.data.length > 0}>
        <Show
          when={
            merged.type === "sparkline" ||
            merged.type === "timeseries" ||
            merged.type === "line" ||
            merged.type === "bar"
          }
          fallback={null}
        >
          <Show when={merged.type === "sparkline"}>
            <Sparkline data={merged.data ?? []} type={merged.type} />
          </Show>
          <Show when={merged.type !== "sparkline"}>
            <svg viewBox="0 0 600 200" {...stylex.attrs(styles.svg)} role="img" aria-label="Chart">
              <Show
                when={merged.type === "bar"}
                fallback={
                  <polyline points={points()} fill="none" stroke="currentColor" stroke-width="2" />
                }
              >
                <For each={merged.data ?? []}>
                  {(datum: ChartDatum, index: () => number) => {
                    const entries = merged.data ?? [];
                    const values = entries.map((entry: ChartDatum) => entry.value);
                    const max = Math.max(...values, 1);
                    const barHeight = max === 0 ? 0 : (datum.value / max) * 200;
                    const barWidth = 600 / Math.max(entries.length, 1);
                    return (
                      <rect
                        x={barWidth * index() + 2}
                        y={200 - barHeight}
                        width={Math.max(barWidth - 4, 1)}
                        height={Math.max(barHeight, 0)}
                        fill="currentColor"
                      />
                    );
                  }}
                </For>
              </Show>
            </svg>
          </Show>
        </Show>
      </Show>
      <div
        ref={(el: HTMLDivElement) => {
          hostRef.current = el;
        }}
        {...stylex.attrs(styles.host)}
      />
      {merged.children}
    </div>
  );
}

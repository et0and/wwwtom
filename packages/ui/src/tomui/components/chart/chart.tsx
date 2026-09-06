import { For, merge, omit, onCleanup, onSettled, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_CHART_VARIANTS = {
  type: {
    line: { classes: "", description: "Line chart rendered as SVG polyline" },
    bar: { classes: "", description: "Bar chart rendered as SVG rects" },
    sparkline: { classes: "", description: "Compact sparkline without axes" },
    timeseries: { classes: "", description: "Timeseries line with time labels" },
  },
  size: {
    sm: { classes: "h-16", description: "Small compact chart" },
    base: { classes: "h-40", description: "Default chart height" },
    lg: { classes: "h-64", description: "Large chart height" },
  },
} as const;

export const TOMUI_CHART_DEFAULT_VARIANTS = {
  type: "line",
  size: "base",
} as const;

export type TomuiChartType = keyof typeof TOMUI_CHART_VARIANTS.type;
export type TomuiChartSize = keyof typeof TOMUI_CHART_VARIANTS.size;

export interface ChartDatum {
  label: string;
  value: number;
}

export type ChartProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element;
  class?: string;
  data?: Array<ChartDatum>;
  height?: number;
  renderChart?: (el: HTMLDivElement) => void;
  size?: TomuiChartSize;
  style?: JSX.CSSProperties;
  type?: TomuiChartType;
};

export function chartVariants(
  props: { type?: TomuiChartType; size?: TomuiChartSize } = {},
): string {
  const merged = merge(TOMUI_CHART_DEFAULT_VARIANTS, props);
  return cn(
    "tomui-chart w-full",
    resolveVariant(TOMUI_CHART_VARIANTS.type, merged.type, TOMUI_CHART_DEFAULT_VARIANTS.type)
      .classes,
    resolveVariant(TOMUI_CHART_VARIANTS.size, merged.size, TOMUI_CHART_DEFAULT_VARIANTS.size)
      .classes,
  );
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
        <svg
          viewBox={`0 0 ${width} ${height}`}
          class="tomui-chart-svg h-full w-full"
          aria-hidden="true"
        >
          <polyline points={points()} fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
      }
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        class="tomui-chart-svg h-full w-full"
        aria-hidden="true"
      >
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
  const rest = omit(
    merged,
    "children",
    "class",
    "data",
    "height",
    "renderChart",
    "size",
    "style",
    "type",
  );
  const points = () => toPoints(merged.data ?? [], 600, 200);
  const baseStyle = (): JSX.CSSProperties | undefined => merged.style;
  const style = (): JSX.CSSProperties | undefined => {
    if (merged.height === undefined) return baseStyle();
    return { ...baseStyle(), height: `${merged.height}px` };
  };
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
      class={cn(chartVariants({ size: merged.size, type: merged.type }), merged.class)}
      style={style()}
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
            <svg
              viewBox="0 0 600 200"
              class="tomui-chart-svg h-full w-full"
              role="img"
              aria-label="Chart"
            >
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
        class="tomui-chart-host contents"
      />
      {merged.children}
    </div>
  );
}

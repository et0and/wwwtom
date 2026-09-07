import { For, Show, createMemo, merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";

export interface BollingerSeries {
  color: string;
  label: string;
  values: Array<number>;
}

export interface BollingerBand {
  lower: number;
  mid: number;
  upper: number;
}

export type BollingerProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  ariaLabel?: string;
  caption?: string;
  children?: JSX.Element;
  class?: string;
  deviations?: number;
  labels?: Array<string>;
  series?: Array<BollingerSeries>;
  span?: number;
  style?: JSX.CSSProperties;
};

export const TOMUI_BOLLINGER_DEFAULTS = {
  deviations: 2,
  span: 5,
} as const;

export function bollinger(
  values: Array<number>,
  span: number,
  deviations: number,
): Array<BollingerBand> {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - span + 1), index + 1);
    const mean = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / slice.length;
    const deviation = Math.sqrt(variance);
    return {
      lower: Math.max(0, mean - deviations * deviation),
      mid: mean,
      upper: mean + deviations * deviation,
    };
  });
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 360;
const MARGIN = { bottom: 40, left: 44, right: 8, top: 12 };

function niceCeiling(value: number): number {
  return Math.max(10, Math.ceil(value / 5) * 5);
}

export function Bollinger(props: BollingerProps) {
  const merged = merge(TOMUI_BOLLINGER_DEFAULTS, props);
  const rest = omit(
    merged,
    "ariaLabel",
    "caption",
    "children",
    "class",
    "deviations",
    "labels",
    "series",
    "span",
    "style",
  );
  const entries = () => merged.series ?? [];
  const bands = createMemo(() =>
    entries().map((entry) => bollinger(entry.values, merged.span, merged.deviations)),
  );
  const ceiling = createMemo(() => {
    const top = bands()
      .flat()
      .reduce((best, band) => Math.max(best, band.upper), 0);
    return niceCeiling(top);
  });
  const ticks = createMemo(() => {
    const step = ceiling() > 30 ? 10 : 5;
    const count = Math.floor(ceiling() / step);
    return Array.from({ length: count + 1 }, (_, index) => (count - index) * step);
  });
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const pointCount = () => Math.max(...entries().map((entry) => entry.values.length), 0);
  const x = (index: number): number =>
    MARGIN.left + (index / Math.max(1, pointCount() - 1)) * plotWidth;
  const y = (value: number): number => MARGIN.top + plotHeight - (value / ceiling()) * plotHeight;
  const bandPath = (band: Array<BollingerBand>): string => {
    const upper = band.map((point, index) => `${x(index).toFixed(1)},${y(point.upper).toFixed(1)}`);
    const lower = band
      .map((point, index) => `${x(index).toFixed(1)},${y(point.lower).toFixed(1)}`)
      .reverse();
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  };
  const midPath = (band: Array<BollingerBand>): string =>
    `M${band.map((point, index) => `${x(index).toFixed(1)},${y(point.mid).toFixed(1)}`).join(" L")}`;
  const labelIndexes = () =>
    (merged.labels ?? [])
      .map((_, index) => index)
      .filter((index) => index % 2 === 0 || index === pointCount() - 1);

  return (
    <div
      data-tomui-component="Bollinger"
      class={cn("tomui-bollinger w-full", merged.class)}
      style={merged.style}
      {...rest}
    >
      <Show when={entries().length > 0}>
        <figure>
          <div aria-hidden="true">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              class="h-auto w-full"
              role="img"
              aria-label={merged.ariaLabel ?? "Trend chart with Bollinger bands"}
            >
              <For each={ticks()}>
                {(tick) => (
                  <>
                    <line
                      x1={MARGIN.left}
                      x2={CHART_WIDTH - MARGIN.right}
                      y1={y(tick)}
                      y2={y(tick)}
                      stroke="currentColor"
                      stroke-opacity="0.2"
                      stroke-dasharray="4 3"
                    />
                    <text
                      x={MARGIN.left - 6}
                      y={y(tick) + 4}
                      text-anchor="end"
                      font-size="11"
                      fill="currentColor"
                    >
                      {tick}%
                    </text>
                  </>
                )}
              </For>
              <For each={entries()}>
                {(entry, index) => (
                  <>
                    <path
                      d={bandPath(bands()[index()] ?? [])}
                      fill={entry.color}
                      fill-opacity="0.15"
                    />
                    <path
                      d={midPath(bands()[index()] ?? [])}
                      fill="none"
                      stroke={entry.color}
                      stroke-width="2"
                    />
                    <Show when={(bands()[index()] ?? []).length > 0}>
                      <circle
                        cx={x(pointCount() - 1)}
                        cy={y((bands()[index()] ?? [])[pointCount() - 1]?.mid ?? 0)}
                        r="3"
                        fill={entry.color}
                      />
                    </Show>
                  </>
                )}
              </For>
              <For each={labelIndexes()}>
                {(index) => (
                  <text
                    x={x(index)}
                    y={CHART_HEIGHT - 12}
                    text-anchor="middle"
                    font-size="11"
                    fill="currentColor"
                  >
                    {(merged.labels ?? [])[index]}
                  </text>
                )}
              </For>
            </svg>
            <div class="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
              <For each={entries()}>
                {(entry) => (
                  <span class="inline-flex items-center gap-1.5">
                    <span
                      class="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ "background-color": entry.color }}
                    />
                    {entry.label}
                  </span>
                )}
              </For>
            </div>
          </div>
          <Show when={merged.caption}>
            {(caption) => <figcaption class="pt-2 text-xs opacity-70">{caption()}</figcaption>}
          </Show>
        </figure>
      </Show>
      {merged.children}
    </div>
  );
}

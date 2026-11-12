import preview from "#.storybook/preview";
import { Chart } from "@tom/ui/chart";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Chart",
  component: Chart,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { renderChart: fn() },
});

const data = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 19 },
  { label: "Wed", value: 8 },
  { label: "Thu", value: 24 },
  { label: "Fri", value: 16 },
];

export const Line = meta.story({
  args: {
    type: "line",
    data,
  },
});

export const Bar = meta.story({
  args: {
    type: "bar",
    data,
  },
});

export const Sparkline = meta.story({
  args: {
    type: "sparkline",
    data,
  },
});

export const Timeseries = meta.story({
  args: {
    type: "timeseries",
    data,
  },
});

export const Small = meta.story({
  args: {
    type: "line",
    size: "sm",
    data,
  },
});

export const Large = meta.story({
  args: {
    type: "bar",
    size: "lg",
    data,
  },
});

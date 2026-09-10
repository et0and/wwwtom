import preview from "#.storybook/preview";
import { DateRangePicker } from "@tom/ui/date-range-picker";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/DateRangePicker",
  component: DateRangePicker,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onChange: fn(), onEndChange: fn(), onStartChange: fn() },
});

export const Default = meta.story({
  args: {
    start: "2026-09-01",
    end: "2026-09-06",
  },
});

export const Subtle = meta.story({
  args: {
    variant: "subtle",
    start: "2026-09-01",
    end: "2026-09-06",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    start: "2026-09-01",
    end: "2026-09-06",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    start: "2026-09-01",
    end: "2026-09-06",
  },
});

export const Invalid = meta.story({
  args: {
    start: "2026-09-10",
    end: "2026-09-01",
  },
});

export const WithMinMax = meta.story({
  args: {
    start: "2026-09-01",
    end: "2026-09-06",
    min: "2026-01-01",
    max: "2026-12-31",
  },
});

import preview from "#.storybook/preview";
import { Meter } from "@tom/ui/meter";

const meta = preview.meta({
  title: "web/Meter",
  component: Meter,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    label: "Storage used",
    value: 42,
  },
});

export const Empty = meta.story({
  args: {
    label: "Storage used",
    value: 0,
  },
});

export const Full = meta.story({
  args: {
    label: "Storage used",
    value: 100,
  },
});

export const CustomValue = meta.story({
  args: {
    label: "Storage used",
    value: 42,
    customValue: "42 of 100 GB",
  },
});

export const HiddenValue = meta.story({
  args: {
    label: "Storage used",
    value: 65,
    showValue: false,
  },
});

export const CustomRange = meta.story({
  args: {
    label: "Score",
    value: 7,
    min: 0,
    max: 10,
  },
});

import preview from "#.storybook/preview";
import { Surface } from "@tom/ui/tomui/surface";

const meta = preview.meta({
  title: "web/Surface",
  component: Surface,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Primary = meta.story({
  args: {
    children: "Card content on a primary surface",
    class: "p-4",
  },
});

export const Secondary = meta.story({
  args: {
    color: "secondary",
    children: "Card content on a secondary surface",
    class: "p-4",
  },
});

export const AsSection = meta.story({
  args: {
    as: "section",
    children: "Section content rendered as a section element",
    class: "p-6",
  },
});

import preview from "#.storybook/preview";
import { Button } from "@tom/ui/tomui/button";
import { Tooltip } from "@tom/ui/tomui/tooltip";

const meta = preview.meta({
  title: "web/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Top = meta.story({
  args: {
    side: "top",
    content: "Save changes",
    children: "Hover me",
  },
});

export const Bottom = meta.story({
  args: {
    side: "bottom",
    content: "More options below",
    children: "Hover me",
  },
});

export const Left = meta.story({
  args: {
    side: "left",
    content: "Go back",
    children: "Hover me",
  },
});

export const Right = meta.story({
  args: {
    side: "right",
    content: "Continue",
    children: "Hover me",
  },
});

export const OnButton = meta.story({
  render: () => (
    <Tooltip content="Add new item">
      <Button variant="primary">Add</Button>
    </Tooltip>
  ),
});

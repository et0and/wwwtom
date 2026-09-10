import preview from "#.storybook/preview";
import { Button } from "@tom/ui/button";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onClick: fn() },
});

export const Primary = meta.story({
  args: {
    variant: "primary",
    children: "Save changes",
  },
});

export const Secondary = meta.story({
  args: {
    variant: "secondary",
    children: "Cancel",
  },
});

export const Ghost = meta.story({
  args: {
    variant: "ghost",
    children: "Skip",
  },
});

export const Destructive = meta.story({
  args: {
    variant: "destructive",
    children: "Delete",
  },
});

export const SecondaryDestructive = meta.story({
  args: {
    variant: "secondary-destructive",
    children: "Remove",
  },
});

export const Outline = meta.story({
  args: {
    variant: "outline",
    children: "Learn more",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    children: "Small",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    children: "Large",
  },
});

export const Loading = meta.story({
  args: {
    variant: "primary",
    loading: true,
    children: "Saving",
  },
});

export const Disabled = meta.story({
  args: {
    disabled: true,
    children: "Disabled",
  },
});

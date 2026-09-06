import preview from "#.storybook/preview";
import { Badge } from "@tom/ui/tomui/badge";

const meta = preview.meta({
  title: "web/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Primary = meta.story({
  args: {
    variant: "primary",
    children: "New",
  },
});

export const Secondary = meta.story({
  args: {
    variant: "secondary",
    children: "Draft",
  },
});

export const Success = meta.story({
  args: {
    variant: "success",
    children: "Active",
  },
});

export const Warning = meta.story({
  args: {
    variant: "warning",
    children: "Pending",
  },
});

export const Error = meta.story({
  args: {
    variant: "error",
    children: "Failed",
  },
});

export const Info = meta.story({
  args: {
    variant: "info",
    children: "Info",
  },
});

export const Beta = meta.story({
  args: {
    variant: "beta",
    children: "Beta",
  },
});

export const Outline = meta.story({
  args: {
    variant: "outline",
    children: "v2.0",
  },
});

export const Dot = meta.story({
  args: {
    appearance: "dot",
    variant: "success",
    children: "Online",
  },
});

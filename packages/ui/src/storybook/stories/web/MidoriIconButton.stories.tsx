import preview from "#.storybook/preview";
import { IconButton } from "@tom/ui/icon-button";
import { MagnifyingGlass } from "@tom/icons/MagnifyingGlass";
import { Trash } from "@tom/icons/Trash";
import { X } from "@tom/icons/X";

const meta = preview.meta({
  title: "web/IconButton",
  component: IconButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    label: "Search",
    icon: <MagnifyingGlass size="sm" />,
  },
});

export const Neutral = meta.story({});

export const Contrast = meta.story({
  args: {
    label: "Close",
    variant: "contrast",
    icon: <X size="sm" />,
  },
});

export const Ghost = meta.story({
  args: {
    label: "Delete",
    variant: "ghost",
    icon: <Trash size="sm" />,
  },
});

export const GhostMuted = meta.story({
  args: {
    label: "Search",
    variant: "ghost-muted",
    icon: <MagnifyingGlass size="sm" />,
  },
});

export const Sizes = meta.story({
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem", "align-items": "center" }}>
      <IconButton label="Small search" size="small" icon={<MagnifyingGlass size="xs" />} />
      <IconButton label="Normal search" size="normal" icon={<MagnifyingGlass size="sm" />} />
      <IconButton label="Large search" size="large" icon={<MagnifyingGlass size="md" />} />
    </div>
  ),
});

export const Disabled = meta.story({
  args: { disabled: true },
});

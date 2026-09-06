import preview from "#.storybook/preview";
import { Switch } from "@tom/ui/tomui/switch";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onCheckedChange: fn() },
});

export const Default = meta.story({
  args: {
    label: "Email notifications",
  },
});

export const Checked = meta.story({
  args: {
    label: "Email notifications",
    checked: true,
  },
});

export const Neutral = meta.story({
  args: {
    label: "Dark mode",
    variant: "neutral",
    checked: true,
  },
});

export const Small = meta.story({
  args: {
    label: "Compact toggle",
    size: "sm",
  },
});

export const Large = meta.story({
  args: {
    label: "Prominent toggle",
    size: "lg",
    checked: true,
  },
});

export const Disabled = meta.story({
  args: {
    label: "Disabled toggle",
    disabled: true,
  },
});

export const Group = meta.story({
  render: () => (
    <Switch.Group legend="Notifications">
      <Switch.Item label="Email" />
      <Switch.Item label="SMS" checked />
    </Switch.Group>
  ),
});

export const GroupWithError = meta.story({
  render: () => (
    <Switch.Group legend="Notifications" error="Turn on at least one channel.">
      <Switch.Item label="Email" />
      <Switch.Item label="SMS" />
    </Switch.Group>
  ),
});

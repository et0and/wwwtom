import preview from "#.storybook/preview";
import { Checkbox } from "@tom/ui/tomui/checkbox";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onCheckedChange: fn() },
});

export const Default = meta.story({
  args: {
    label: "Accept terms",
  },
});

export const Checked = meta.story({
  args: {
    label: "Subscribed",
    checked: true,
  },
});

export const Indeterminate = meta.story({
  args: {
    label: "Select all",
    indeterminate: true,
  },
});

export const Error = meta.story({
  args: {
    label: "Accept terms",
    variant: "error",
  },
});

export const Disabled = meta.story({
  args: {
    label: "Disabled option",
    disabled: true,
  },
});

export const DisabledChecked = meta.story({
  args: {
    label: "Disabled checked",
    checked: true,
    disabled: true,
  },
});

export const ControlLast = meta.story({
  args: {
    label: "Label first",
    controlFirst: false,
  },
});

export const Group = meta.story({
  render: () => (
    <Checkbox.Group legend="Notifications">
      <Checkbox.Item label="Email" value="email" />
      <Checkbox.Item label="SMS" value="sms" />
      <Checkbox.Item label="Push" value="push" />
    </Checkbox.Group>
  ),
});

export const GroupWithError = meta.story({
  render: () => (
    <Checkbox.Group legend="Notifications" error="Select at least one option.">
      <Checkbox.Item label="Email" value="email" variant="error" />
      <Checkbox.Item label="SMS" value="sms" variant="error" />
    </Checkbox.Group>
  ),
});

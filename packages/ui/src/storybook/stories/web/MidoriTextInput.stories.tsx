import preview from "#.storybook/preview";
import { IconButton } from "@tom/ui/icon-button";
import { TextInput } from "@tom/ui/text-input";
import { MagnifyingGlass } from "@tom/icons/MagnifyingGlass";
import { X } from "@tom/icons/X";

const meta = preview.meta({
  title: "web/TextInput",
  component: TextInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    placeholder: "Search people",
  },
});

export const Default = meta.story({
  render: (args) => (
    <div style={{ width: "18rem" }}>
      <TextInput {...args} />
    </div>
  ),
});

export const WithLeadingIcon = meta.story({
  args: {
    leadingIcon: <MagnifyingGlass size="sm" />,
    placeholder: "Search people",
  },
  render: (args) => (
    <div style={{ width: "18rem" }}>
      <TextInput {...args} />
    </div>
  ),
});

export const WithTrailing = meta.story({
  args: {
    leadingIcon: <MagnifyingGlass size="sm" />,
    placeholder: "Search people",
    trailing: (
      <IconButton label="Clear" size="small" variant="ghost-muted" icon={<X size="xs" />} />
    ),
  },
  render: (args) => (
    <div style={{ width: "18rem" }}>
      <TextInput {...args} />
    </div>
  ),
});

export const Numeric = meta.story({
  args: { numeric: true, inputmode: "numeric", placeholder: "10" },
  render: (args) => (
    <div style={{ width: "8rem" }}>
      <TextInput {...args} />
    </div>
  ),
});

export const Invalid = meta.story({
  args: { invalid: true, value: "not an amount" },
  render: (args) => (
    <div style={{ width: "18rem" }}>
      <TextInput {...args} />
    </div>
  ),
});

export const Surfaces = meta.story({
  render: () => (
    <div style={{ display: "flex", width: "18rem", "flex-direction": "column", gap: "0.5rem" }}>
      <TextInput surface="base" placeholder="Base" />
      <TextInput surface="layer-1" placeholder="Layer 1" />
      <TextInput surface="invisible" placeholder="Invisible" />
    </div>
  ),
});

export const Sizes = meta.story({
  render: () => (
    <div style={{ display: "flex", width: "18rem", "flex-direction": "column", gap: "0.5rem" }}>
      <TextInput appearance="small" placeholder="Small" />
      <TextInput appearance="base" placeholder="Base" />
      <TextInput appearance="large" placeholder="Large" />
    </div>
  ),
});

export const Disabled = meta.story({
  args: { disabled: true, value: "Can't touch this" },
  render: (args) => (
    <div style={{ width: "18rem" }}>
      <TextInput {...args} />
    </div>
  ),
});

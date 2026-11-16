import preview from "#.storybook/preview";
import { CommandPalette } from "@tom/ui/command-palette";

const meta = preview.meta({
  title: "web/CommandPalette",
  component: CommandPalette,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const actions = [
  { id: "new-file", label: "Create new file", hint: "⌘N" },
  { id: "open-settings", label: "Open settings", hint: "⌘," },
  { id: "toggle-sidebar", label: "Toggle sidebar" },
  { id: "delete-project", label: "Delete project", disabled: true },
];

export const Open = meta.story({
  render: () => (
    <div style={{ height: "24rem", width: "36rem" }}>
      <CommandPalette defaultOpen items={actions} />
    </div>
  ),
});

export const CustomPlaceholder = meta.story({
  render: () => (
    <div style={{ height: "24rem", width: "36rem" }}>
      <CommandPalette defaultOpen items={actions} placeholder="Type a command…" />
    </div>
  ),
});

export const WithSelection = meta.story({
  render: () => (
    <div style={{ height: "24rem", width: "36rem" }}>
      <CommandPalette defaultOpen items={actions} onSelect={() => undefined} />
    </div>
  ),
});

export const Empty = meta.story({
  render: () => (
    <div style={{ height: "24rem", width: "36rem" }}>
      <CommandPalette defaultOpen items={[]} />
    </div>
  ),
});

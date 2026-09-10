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
    <div class="h-96 w-xl">
      <CommandPalette open items={actions} onOpenChange={() => undefined} />
    </div>
  ),
});

export const CustomPlaceholder = meta.story({
  render: () => (
    <div class="h-96 w-xl">
      <CommandPalette
        open
        items={actions}
        placeholder="Type a command…"
        onOpenChange={() => undefined}
      />
    </div>
  ),
});

export const WithSelection = meta.story({
  render: () => (
    <div class="h-96 w-xl">
      <CommandPalette
        open
        items={actions}
        onSelect={() => undefined}
        onOpenChange={() => undefined}
      />
    </div>
  ),
});

export const Empty = meta.story({
  render: () => (
    <div class="h-96 w-xl">
      <CommandPalette open items={[]} onOpenChange={() => undefined} />
    </div>
  ),
});

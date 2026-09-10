import preview from "#.storybook/preview";
import { Empty } from "@tom/ui/empty";

const meta = preview.meta({
  title: "web/Empty",
  component: Empty,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    title: "No results found",
    description: "Try adjusting your search terms.",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    title: "No packages found",
    description: "Get started by installing your first package.",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    title: "No projects yet",
    description: "Create your first project to get started.",
  },
});

export const WithCommand = meta.story({
  args: {
    title: "Install the toolkit",
    description: "Run this command to add the UI package.",
    commandLine: "npm install @tom/ui",
  },
});

export const WithContents = meta.story({
  render: () => (
    <Empty
      title="No messages yet"
      description="When you receive messages they will show up here."
      contents={<span class="text-sm text-tomui-subtle">Refresh to check again</span>}
    />
  ),
});

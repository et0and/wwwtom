import preview from "#.storybook/preview";
import { TableOfContents } from "@tom/ui/tomui/table-of-contents";

const meta = preview.meta({
  title: "web/TableOfContents",
  component: TableOfContents,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const headings = [
  { id: "introduction", label: "Introduction" },
  { id: "installation", label: "Installation" },
  { id: "usage", label: "Usage" },
  { id: "api-reference", label: "API reference", level: 3 },
];

export const Default = meta.story({
  args: {
    headings,
  },
});

export const WithActive = meta.story({
  args: {
    headings,
    activeId: "installation",
  },
});

export const CustomTitle = meta.story({
  args: {
    headings,
    title: "Contents",
  },
});

export const NestedLevels = meta.story({
  args: {
    headings: [
      { id: "overview", label: "Overview" },
      { id: "details", label: "Details", level: 3 },
      { id: "deep-dive", label: "Deep dive", level: 4 },
      { id: "next-steps", label: "Next steps" },
    ],
  },
});

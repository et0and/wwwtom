import preview from "#.storybook/preview";
import { Divider } from "@tom/ui/divider";

const meta = preview.meta({
  title: "web/Divider",
  component: Divider,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Horizontal = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Divider />
    </div>
  ),
});

export const Vertical = meta.story({
  render: () => (
    <div style={{ display: "flex", height: "4rem", "align-items": "center", gap: "1rem" }}>
      <span>Left</span>
      <Divider orientation="vertical" />
      <span>Right</span>
    </div>
  ),
});

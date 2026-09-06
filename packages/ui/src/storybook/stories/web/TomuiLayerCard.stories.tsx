import preview from "#.storybook/preview";
import { LayerCard } from "@tom/ui/tomui/layer-card";

const meta = preview.meta({
  title: "web/LayerCard",
  component: LayerCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    children: "Get started with TomUI",
    class: "p-4",
  },
});

export const Layered = meta.story({
  render: () => (
    <LayerCard layered>
      <LayerCard.Secondary>Next steps</LayerCard.Secondary>
      <LayerCard.Primary>Get started with TomUI</LayerCard.Primary>
    </LayerCard>
  ),
});

export const LayeredGuide = meta.story({
  render: () => (
    <LayerCard layered>
      <LayerCard.Secondary>Getting started</LayerCard.Secondary>
      <LayerCard.Primary>Follow the quick start guide to ship today</LayerCard.Primary>
    </LayerCard>
  ),
});

import preview from "#.storybook/preview";
import { Flow, FlowNode } from "@tom/ui/tomui/flow";

const meta = preview.meta({
  title: "web/Flow",
  component: Flow,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Vertical = meta.story({
  render: () => (
    <Flow>
      <FlowNode nodeId="one">First step</FlowNode>
      <FlowNode nodeId="two">Second step</FlowNode>
      <FlowNode nodeId="three">Third step</FlowNode>
    </Flow>
  ),
});

export const Horizontal = meta.story({
  render: () => (
    <Flow orientation="horizontal">
      <FlowNode nodeId="one">First step</FlowNode>
      <FlowNode nodeId="two">Second step</FlowNode>
      <FlowNode nodeId="three">Third step</FlowNode>
    </Flow>
  ),
});

export const Centered = meta.story({
  render: () => (
    <Flow align="center">
      <FlowNode nodeId="one">First step</FlowNode>
      <FlowNode nodeId="two">Second step</FlowNode>
    </Flow>
  ),
});

export const WithDisabled = meta.story({
  render: () => (
    <Flow>
      <FlowNode nodeId="one">Active step</FlowNode>
      <FlowNode nodeId="two" disabled>
        Disabled step
      </FlowNode>
      <FlowNode nodeId="three">Next step</FlowNode>
    </Flow>
  ),
});

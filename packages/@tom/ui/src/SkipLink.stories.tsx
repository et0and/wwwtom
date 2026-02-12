import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { SkipLink } from "./SkipLink";

const meta = {
  title: "Components/SkipLink",
  render: () => {
    const div = document.createElement("div");
    render(SkipLink, div);
    return div;
  },
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "SkipLink provides accessibility by allowing keyboard users to skip navigation and jump to main content. It is visually hidden until focused.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const Visible: Story = {
  parameters: {
    docs: {
      description: {
        story: "Use Tab key to focus the SkipLink and make it visible.",
      },
    },
  },
};

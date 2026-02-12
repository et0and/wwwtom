import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { Footer } from "./Footer";

const meta = {
  title: "Components/Footer",
  render: () => {
    const div = document.createElement("div");
    render(Footer, div);
    return div;
  },
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {};

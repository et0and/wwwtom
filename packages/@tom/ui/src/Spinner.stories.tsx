import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { Spinner } from "./Spinner";

const meta = {
  title: "Components/Spinner",
  render: (args) => {
    const div = document.createElement("div");
    render(() => Spinner(args), div);
    return div;
  },
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    color: {
      control: "select",
      options: ["black", "grey", "white"],
      description: "The color of the spinner",
    },
    class: {
      control: "text",
      description: "Additional CSS classes for sizing",
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {},
};

export const Black: Story = {
  args: {
    color: "black",
  },
};

export const Grey: Story = {
  args: {
    color: "grey",
  },
};

export const White: Story = {
  args: {
    color: "white",
  },
};

export const Small: Story = {
  args: {
    color: "black",
    class: "h-3 w-3",
  },
};

export const Large: Story = {
  args: {
    color: "black",
    class: "h-8 w-8",
  },
};

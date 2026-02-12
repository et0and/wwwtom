import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { Link } from "./Link";
import { Router } from "@solidjs/router";

const meta = {
  title: "Components/Link",
  render: (args) => {
    const div = document.createElement("div");
    render(
      () => (
        <Router>
          <Link {...args} href={args.href || "/"}>
            {args.children || "Link Text"}
          </Link>
        </Router>
      ),
      div,
    );
    return div;
  },
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    href: {
      control: "text",
      description: "The URL the link points to",
    },
    preload: {
      control: "boolean",
      description: "Whether to preload the route",
    },
    class: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    href: "/about",
    children: "About Page",
  },
};

export const WithPreload: Story = {
  args: {
    href: "/work",
    children: "Work Page",
    preload: true,
  },
};

export const WithCustomClass: Story = {
  args: {
    href: "/posts",
    children: "Writing",
    class: "text-blue-600 underline",
  },
};

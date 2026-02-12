import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { Nav } from "./Nav";
import { Router } from "@solidjs/router";

const meta = {
  title: "Components/Nav",
  render: () => {
    const div = document.createElement("div");
    render(
      () => (
        <Router>
          <Nav />
        </Router>
      ),
      div,
    );
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

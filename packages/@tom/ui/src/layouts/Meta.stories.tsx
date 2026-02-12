import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { Metadata } from "./Meta";
import { MetaProvider } from "@solidjs/meta";

const meta = {
  title: "Layouts/Metadata",
  render: (args) => {
    const div = document.createElement("div");
    render(
      () => (
        <MetaProvider>
          <Metadata
            title={args.title || "Default Title"}
            metaType={args.metaType || "description"}
            metaContent={args.metaContent || "Default description"}
            canonical={args.canonical}
          />
        </MetaProvider>
      ),
      div,
    );
    return div;
  },
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Metadata component manages document head meta tags including title, description, Open Graph, and Twitter cards.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Page title",
    },
    metaType: {
      control: "text",
      description: "Meta tag name attribute",
    },
    metaContent: {
      control: "text",
      description: "Meta tag content attribute",
    },
    canonical: {
      control: "text",
      description: "Canonical URL",
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    title: "Home",
    metaType: "description",
    metaContent: "Welcome to my portfolio website",
  },
};

export const WithCanonical: Story = {
  args: {
    title: "About",
    metaType: "description",
    metaContent: "Learn more about me",
    canonical: "https://tom.so/about",
  },
};

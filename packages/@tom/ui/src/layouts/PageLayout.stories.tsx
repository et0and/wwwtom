import type { Meta, StoryObj } from "@storybook/html";
import { render } from "solid-js/web";
import { PageLayout } from "./PageLayout";
import { MetaProvider } from "@solidjs/meta";

const meta = {
  title: "Layouts/PageLayout",
  render: (args) => {
    const div = document.createElement("div");
    render(
      () => (
        <MetaProvider>
          <PageLayout {...args}>{args.children || <div>Page content goes here...</div>}</PageLayout>
        </MetaProvider>
      ),
      div,
    );
    return div;
  },
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    title: {
      control: "text",
      description: "Page title",
    },
    description: {
      control: "text",
      description: "Page description for meta tags",
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
    title: "About",
    description: "Learn more about Tom Hackshaw",
    children: <div class="prose">Page content goes here...</div>,
  },
};

export const WithFrontmatter: Story = {
  args: {
    frontmatter: {
      title: "Blog Post Title",
      summary: "A summary of the blog post content",
      publishedAt: "2024-01-01",
    },
    children: <article>Blog post content...</article>,
  },
};

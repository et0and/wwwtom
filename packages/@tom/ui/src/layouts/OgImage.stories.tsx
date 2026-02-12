import type { Meta, StoryObj } from "@storybook/html";
import { OgTemplates } from "./OgImage";

const meta = {
  title: "Layouts/OgTemplates",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "OgTemplates provides HTML templates for generating Open Graph images. These templates return HTML strings that can be rendered to images.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const DefaultTemplate: Story = {
  render: () => {
    const html = OgTemplates.default({
      title: "Sample Blog Post",
      summary: "This is a preview of the blog post content",
    });
    const div = document.createElement("div");
    div.style.width = "600px";
    div.style.height = "315px";
    div.style.overflow = "hidden";
    div.style.border = "1px solid #ccc";
    div.innerHTML = html;
    return div;
  },
};

export const MinimalTemplate: Story = {
  render: () => {
    const html = OgTemplates.minimal({
      title: "Project Name",
      summary: "A brief description",
    });
    const div = document.createElement("div");
    div.style.width = "600px";
    div.style.height = "315px";
    div.style.overflow = "hidden";
    div.style.border = "1px solid #ccc";
    div.innerHTML = html;
    return div;
  },
};

export const DeveloperTemplate: Story = {
  render: () => {
    const html = OgTemplates.developer({
      title: "Code Example",
      summary: "Technical documentation and examples",
    });
    const div = document.createElement("div");
    div.style.width = "600px";
    div.style.height = "315px";
    div.style.overflow = "hidden";
    div.style.border = "1px solid #ccc";
    div.innerHTML = html;
    return div;
  },
};

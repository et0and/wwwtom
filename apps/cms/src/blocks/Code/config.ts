import type { Block } from "payload";

export const Code: Block = {
  slug: "code",
  interfaceName: "CodeBlock",
  fields: [
    {
      name: "language",
      type: "select",
      defaultValue: "typescript",
      options: [
        {
          label: "Typescript",
          value: "typescript",
        },
        {
          label: "Javascript",
          value: "javascript",
        },
        {
          label: "Python",
          value: "python",
        },
        {
          label: "Rust",
          value: "rust",
        },
        {
          label: "HTML",
          value: "html",
        },
        {
          label: "CSS",
          value: "css",
        },
      ],
    },
    {
      name: "code",
      type: "textarea",
      label: false,
      required: true,
    },
    {
      name: "fileName",
      type: "text",
      label: "File name (optional)",
    },
    {
      name: "showLineNumbers",
      type: "checkbox",
      defaultValue: false,
      label: "Show line numbers",
    },
  ],
};

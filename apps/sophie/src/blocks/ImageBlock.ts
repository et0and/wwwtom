import type { Block } from "payload";

export const ImageBlock: Block = {
  slug: "image",
  interfaceName: "ImageBlock",
  fields: [
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
    },
    {
      name: "caption",
      type: "text",
    },
    {
      name: "layout",
      type: "select",
      options: ["full", "wide", "centered"],
      defaultValue: "centered",
    },
  ],
};

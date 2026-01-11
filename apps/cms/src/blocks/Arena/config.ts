import type { Block } from "payload";

export const Arena: Block = {
  slug: "arena",
  fields: [
    {
      name: "arenaSlug",
      type: "text",
      label: "Are.na Channel Slug",
      required: true,
      admin: {
        description: 'Enter the Are.na channel slug (e.g., "my-channel-name")',
      },
    },
    {
      name: "arenaTitle",
      type: "text",
      label: "Are.na Channel Title",
      required: false,
      admin: {
        description: 'Enter the Are.na channel title (e.g., "My Channel Title")',
      },
    },
  ],
  interfaceName: "ArenaBlock",
};

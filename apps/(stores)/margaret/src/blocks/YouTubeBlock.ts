import type { Block } from "payload";

const validateYouTubeUrl = (value: string | undefined): true | string => {
  if (!value) return "Please enter a YouTube URL";

  // Support various YouTube URL formats
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    /^(https?:\/\/)?(m\.)?youtube\.com\/watch\?v=[\w-]+/,
  ];

  const isValid = patterns.some((pattern) => pattern.test(value));
  return isValid || "Please enter a valid YouTube URL";
};

export const YouTubeBlock: Block = {
  slug: "youtube",
  interfaceName: "YouTubeBlock",
  fields: [
    {
      name: "url",
      type: "text",
      required: true,
      validate: validateYouTubeUrl,
    },
    {
      name: "aspectRatio",
      type: "select",
      options: ["16:9", "4:3", "1:1"],
      defaultValue: "16:9",
    },
    {
      name: "caption",
      type: "text",
    },
  ],
};

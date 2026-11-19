import preview from "#.storybook/preview";
import { Loader } from "@tom/ui/loader";

const meta = preview.meta({
  title: "web/Loader",
  component: Loader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {},
});

export const Small = meta.story({
  args: {
    size: "sm",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
  },
});

export const CustomSize = meta.story({
  args: {
    size: 48,
  },
});

export const CustomLabel = meta.story({
  args: {
    "aria-label": "Saving changes",
  },
});

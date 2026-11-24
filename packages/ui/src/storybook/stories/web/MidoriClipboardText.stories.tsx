import preview from "#.storybook/preview";
import { ClipboardText } from "@tom/ui/clipboard-text";

const meta = preview.meta({
  title: "web/ClipboardText",
  component: ClipboardText,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    text: "sk_live_abc123",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    text: "npm install @tom/ui",
  },
});

export const Base = meta.story({
  args: {
    size: "base",
    text: "0c239dd2",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    text: "deploy-token-007",
  },
});

export const WithTooltip = meta.story({
  args: {
    text: "abc123",
    tooltip: { text: "Copy", copiedText: "Copied!", side: "top" },
  },
});

export const CustomCopyValue = meta.story({
  args: {
    text: "npm install @tom/ui",
    textToCopy: "pnpm add @tom/ui",
  },
});

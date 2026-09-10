import preview from "#.storybook/preview";
import { Text } from "@tom/ui/text";

const meta = preview.meta({
  title: "web/Text",
  component: Text,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Body = meta.story({
  args: {
    variant: "body",
    children: "Default body text.",
  },
});

export const Heading = meta.story({
  args: {
    variant: "heading",
    as: "h2",
    children: "Section heading",
  },
});

export const HeadingLarge = meta.story({
  args: {
    variant: "heading",
    size: "lg",
    as: "h1",
    children: "Page heading",
  },
});

export const Secondary = meta.story({
  args: {
    variant: "secondary",
    children: "Muted helper text.",
  },
});

export const Success = meta.story({
  args: {
    variant: "success",
    children: "Changes saved.",
  },
});

export const Error = meta.story({
  args: {
    variant: "error",
    children: "Something went wrong.",
  },
});

export const Mono = meta.story({
  args: {
    variant: "mono",
    children: "pnpm build",
  },
});

export const MonoSecondary = meta.story({
  args: {
    variant: "mono-secondary",
    children: "build finished in 2.4s",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    children: "Small body text.",
  },
});

export const Bold = meta.story({
  args: {
    bold: true,
    children: "Bold body text.",
  },
});

export const Truncated = meta.story({
  args: {
    truncate: true,
    children: "A long line of text that truncates instead of wrapping.",
  },
});
